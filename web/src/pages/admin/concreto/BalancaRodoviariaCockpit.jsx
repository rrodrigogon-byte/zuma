import React, { useState, useEffect, useRef } from 'react';
import { api, fmtR } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

export default function BalancaRodoviariaCockpit({ onVoltar }) {
  const { token } = useAuth();

  // Estados principais
  const [carregando, setCarregando] = useState(false);
  const [hardware, setHardware] = useState({
    semaforoEntrada: 'verde',
    cancelaEntrada: 'fechada',
    semaforoSaida: 'vermelho',
    cancelaSaida: 'fechada',
    sensorBarreiraEntrada: false,
    sensorBarreiraSaida: false,
    sensorPresencaPlataforma: false,
    posicionamentoCorreto: true,
    pesoAtualKg: 0,
    estabilidade: 'estavel',
    taraAtualKg: 0,
    pesoLiquidoAtualKg: 0,
    zeroRastreado: true,
    capacidadeMaximaKg: 80000,
    divisaoKg: 10,
    cameraLprAtiva: true,
    placaDetectada: '',
    rfidDetectado: '',
    confiancaLpr: 0.98,
    modoOperacao: 'remoto',
    interfoneAtivo: false,
    mensagemInterfone: 'Aguardando aproximação de veículo...',
    veiculoAtual: null,
    veiculosNoPatio: []
  });

  const [estatisticas, setEstatisticas] = useState({
    totalVeiculosHoje: 0,
    totalToneladasHoje: 0,
    tempoMedioPesagemSegundos: 38,
    veiculosNoPatioQtd: 0,
    faturamentoPesagensHoje: 0
  });

  const [tickets, setTickets] = useState([]);
  const [veiculosPatio, setVeiculosPatio] = useState([]);
  const [buscaTermo, setBuscaTermo] = useState('');
  const [abaOperacao, setAbaOperacao] = useState('segunda_pesagem'); // 'primeira_pesagem' | 'segunda_pesagem' | 'avulsa' | 'historico'

  // Form de Entrada (1ª Pesagem)
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
    taraKg: 14280,
    pesoAtualKg: 14280
  });

  // Form de Saída (2ª Pesagem)
  const [veiculoPatioSelecionado, setVeiculoPatioSelecionado] = useState(null);
  const [formSaida, setFormSaida] = useState({
    pesoBrutoKg: 33480,
    taraKg: 14280,
    tipoMaterial: 'Concreto Usinado Estrutural FCK 30 MPa',
    densidadeKgM3: 2400,
    precoUnitarioM3: 420.00
  });

  // Modal de Ticket
  const [modalTicket, setModalTicket] = useState(null);

  // Assinatura Touch no Canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);

  // Mensagem Interfone rápida
  const [textoInterfone, setTextoInterfone] = useState('');

  // Carregar status inicial
  const carregarStatus = async () => {
    try {
      setCarregando(true);
      const res = await api.get('/api/admin/concreto/balanca/status');
      if (res?.ok) {
        setHardware(res.hardware || {});
        setEstatisticas(res.estatisticasHoje || {});
        setVeiculosPatio(res.veiculosNoPatio || []);
        setTickets(res.ultimosTickets || []);
        if (res.veiculosNoPatio?.length > 0 && !veiculoPatioSelecionado) {
          selecionarVeiculoPatio(res.veiculosNoPatio[0]);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar status da balança:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarStatus();
    const interval = setInterval(carregarStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  // Executar comando remoto de automação
  const executarComando = async (comando, payload = {}) => {
    try {
      const res = await api.post('/api/admin/concreto/balanca/comando', { comando, payload });
      if (res?.ok) {
        setHardware(res.hardware);
      }
    } catch (err) {
      alert('Erro ao enviar comando para a balança: ' + err.message);
    }
  };

  // Simular veículo
  const simularCenario = async (cenario) => {
    let payload = {};
    if (cenario === 'betoneira') {
      payload = {
        placa: 'BT-01 (RRA-4E80)',
        rfid: 'TAG-MT-0428',
        modelo: 'Caminhão Betoneira VW Constellation 26.280 8x4',
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
        modelo: 'Cavalo Scania R450 + Caçamba Basculante Rossetti',
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
    } else if (cenario === 'vazio_tara') {
      payload = {
        placa: 'CAR-15 (QBZ-7710)',
        rfid: 'TAG-MT-7710',
        modelo: 'Caminhão Caçamba Basculante 3 Eixos',
        motorista: 'Laércio Silveira',
        cpfMotorista: '512.441.982-00',
        transportadora: 'TransParecis',
        cliente: 'Construtora Vale do Sepotuba',
        produto: 'Brita 1 Granítica',
        pesoBrutoKg: 13200,
        taraKg: 13200,
        tipoOperacao: 'expedicao_agregados',
        foraPosicao: false
      };
    } else if (cenario === 'fora_posicao') {
      payload = {
        placa: 'TRC-09 (KBB-3301)',
        rfid: 'TAG-MT-3301',
        modelo: 'Caminhão Truck Caçamba',
        motorista: 'João Mendes',
        pesoBrutoKg: 28500,
        taraKg: 11000,
        foraPosicao: true
      };
    }

    if (cenario === 'liberar') {
      await executarComando('remover_veiculo');
    } else {
      await executarComando('simular_veiculo', payload);
    }
  };

  // Selecionar veículo do pátio para 2ª pesagem
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

  // Registrar 1ª Pesagem (Entrada)
  const salvarPrimeiraPesagem = async (e) => {
    e.preventDefault();
    try {
      setCarregando(true);
      const res = await api.post('/api/admin/concreto/balanca/entrada', {
        ...formEntrada,
        pesoAtualKg: hardware.pesoAtualKg || formEntrada.taraKg
      });
      if (res?.ok) {
        alert(`1ª Pesagem registrada com sucesso para o veículo ${res.veiculoPatio.placa}! O caminhão foi direcionado ao pátio.`);
        carregarStatus();
        setAbaOperacao('segunda_pesagem');
      }
    } catch (err) {
      alert('Erro ao registrar entrada: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // Concluir 2ª Pesagem (Saída e Emissão de Ticket 80t)
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
        carregarStatus();
      }
    } catch (err) {
      alert('Erro ao concluir pesagem de saída: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // Funções de Canvas para Assinatura Touch
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
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0F172A';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const pararDesenho = () => {
    setIsDrawing(false);
  };

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
  const cfemCalculado = isMineral ? +(valorTotalCalculado * 0.015).toFixed(2) : 0;

  // Limite Lei da Balança (CONTRAN)
  const limiteContranKg = formSaida.pesoBrutoKg > 50000 ? 57000 : formSaida.pesoBrutoKg > 30000 ? 36000 : 23000;
  const excessoPeso = Math.max(0, formSaida.pesoBrutoKg - limiteContranKg);

  return (
    <div style={{ background: '#0B0F19', color: '#F1F5F9', minHeight: '100vh', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* BARRA SUPERIOR DE CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', border: '1px solid #1F293D', borderRadius: '10px', padding: '14px 20px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onVoltar && (
              <button onClick={onVoltar} style={{ background: '#1F293D', border: '1px solid #374151', color: '#CBD5E1', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>
                ← Voltar
              </button>
            )}
            <h1 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#00D2FF' }}>⚖️</span> Balança Rodoviária 80t Toledo
              <span style={{ fontSize: '11px', background: '#0284C7', color: '#FFFFFF', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>CCO Central</span>
            </h1>
          </div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '3px' }}>
            Serrano Concreto &amp; Mineração · Rodovia MT-358 km 08 · Calibração IPEM-MT / INMETRO Portaria 042/2026
          </div>
        </div>

        {/* MODO DE OPERAÇÃO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', padding: '3px' }}>
            <button
              onClick={() => executarComando('modo_operacao', { modo: 'remoto' })}
              style={{ background: hardware.modoOperacao === 'remoto' ? '#0284C7' : 'transparent', color: hardware.modoOperacao === 'remoto' ? '#FFFFFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
              📡 Remota (CCO)
            </button>
            <button
              onClick={() => executarComando('modo_operacao', { modo: 'local' })}
              style={{ background: hardware.modoOperacao === 'local' ? '#0284C7' : 'transparent', color: hardware.modoOperacao === 'local' ? '#FFFFFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
              🏢 Local (Guarita)
            </button>
            <button
              onClick={() => executarComando('modo_operacao', { modo: 'autoatendimento' })}
              style={{ background: hardware.modoOperacao === 'autoatendimento' ? '#0284C7' : 'transparent', color: hardware.modoOperacao === 'autoatendimento' ? '#FFFFFF' : '#94A3B8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
              🤖 Totem Motorista
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0F172A', border: '1px solid #10B981', color: '#10B981', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }}></span>
            Toledo Prix 9094 Online
          </div>
        </div>
      </div>

      {/* PAINEL SUPERIOR: DISPLAY TOLEDO PRIX 9094 + PISTA INTERATIVA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        
        {/* DISPLAY LED 7-SEGMENTOS TOLEDO */}
        <div style={{ background: '#050811', border: '2px solid #1F293D', borderRadius: '12px', padding: '16px', position: 'relative', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#E11D48', color: '#FFF', fontWeight: '900', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px' }}>TOLEDO</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>Indicador Digital Prix 9094 · Rodoviária 80t</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>DIVISÃO: e=10 kg</div>
          </div>

          {/* DÍGITOS GIGANTES LED VERDE */}
          <div style={{ background: '#020408', border: '1px solid #0F172A', borderRadius: '8px', padding: '20px 16px', textAlign: 'right', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '8px', left: '12px', display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: hardware.estabilidade === 'estavel' ? '#10B981' : '#475569', background: hardware.estabilidade === 'estavel' ? 'rgba(16, 185, 129, 0.15)' : 'transparent', border: `1px solid ${hardware.estabilidade === 'estavel' ? '#10B981' : '#334155'}`, padding: '2px 6px', borderRadius: '3px' }}>
                ● ESTÁVEL
              </span>
              <span style={{ fontSize: '10px', fontWeight: '800', color: hardware.zeroRastreado ? '#10B981' : '#475569', background: hardware.zeroRastreado ? 'rgba(16, 185, 129, 0.15)' : 'transparent', border: `1px solid ${hardware.zeroRastreado ? '#10B981' : '#334155'}`, padding: '2px 6px', borderRadius: '3px' }}>
                &gt;0&lt; ZERO
              </span>
              <span style={{ fontSize: '10px', fontWeight: '800', color: hardware.taraAtualKg > 0 ? '#F59E0B' : '#475569', background: hardware.taraAtualKg > 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent', border: `1px solid ${hardware.taraAtualKg > 0 ? '#F59E0B' : '#334155'}`, padding: '2px 6px', borderRadius: '3px' }}>
                T TARA
              </span>
              <span style={{ fontSize: '10px', fontWeight: '800', color: '#00D2FF', background: 'rgba(0, 210, 255, 0.15)', border: '1px solid #00D2FF', padding: '2px 6px', borderRadius: '3px' }}>
                B BRUTO
              </span>
            </div>

            <div style={{ fontSize: '56px', fontWeight: '900', fontFamily: 'monospace', color: '#00FF66', textShadow: '0 0 15px rgba(0, 255, 102, 0.65)', lineHeight: 1, letterSpacing: '2px', marginTop: '16px' }}>
              {Number(hardware.pesoAtualKg || 0).toLocaleString('pt-BR')} <span style={{ fontSize: '24px', color: '#00FF66', textShadow: 'none' }}>kg</span>
            </div>

            {/* SUB-MOSTRADORES */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #0F172A', marginTop: '14px', paddingTop: '8px', fontSize: '11px', color: '#94A3B8' }}>
              <div>Bruto: <strong style={{ color: '#00D2FF' }}>{Number(hardware.pesoAtualKg || 0).toLocaleString('pt-BR')} kg</strong></div>
              <div>Tara: <strong style={{ color: '#F59E0B' }}>{Number(hardware.taraAtualKg || 0).toLocaleString('pt-BR')} kg</strong></div>
              <div>Líquido: <strong style={{ color: '#10B981' }}>{Number(hardware.pesoLiquidoAtualKg || 0).toLocaleString('pt-BR')} kg</strong></div>
            </div>
          </div>

          {/* TECLADO DE FUNÇÕES RÁPIDAS DA BALANÇA */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => executarComando('zerar_balanca')}
              style={{ background: '#1E293B', border: '1px solid #334155', color: '#F1F5F9', borderRadius: '6px', padding: '8px 4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' }}>
              &gt;0&lt; Zerar
            </button>
            <button
              onClick={() => {
                const t = prompt('Digite a tara manual em kg:', hardware.taraAtualKg || '14280');
                if (t !== null) executarComando('tara_manual', { taraKg: Number(t) });
              }}
              style={{ background: '#1E293B', border: '1px solid #334155', color: '#F59E0B', borderRadius: '6px', padding: '8px 4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' }}>
              T Tara Manual
            </button>
            <button
              onClick={() => {
                setFormSaida(prev => ({ ...prev, pesoBrutoKg: hardware.pesoAtualKg }));
                alert(`Peso capturado com sucesso: ${hardware.pesoAtualKg} kg`);
              }}
              style={{ background: '#0284C7', border: 'none', color: '#FFFFFF', borderRadius: '6px', padding: '8px 4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' }}>
              ⚡ Capturar Peso
            </button>
            <button
              onClick={() => alert('Web Serial API: Conectando com Indicador Toledo Prix 9094 na porta COM3 (Baud Rate 9600, 8, N, 1)...')}
              style={{ background: '#1E293B', border: '1px solid #00D2FF', color: '#00D2FF', borderRadius: '6px', padding: '8px 4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' }}>
              🔌 Serial RS232
            </button>
          </div>
        </div>

        {/* ESQUEMA DA PISTA RODOVIÁRIA 21M INTERATIVA */}
        <div style={{ background: '#111827', border: '1px solid #1F293D', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🛣️ Pista Rodoviária 21m · Sensores &amp; Semáforos
            </div>
            <div style={{ fontSize: '10px', color: hardware.posicionamentoCorreto ? '#10B981' : '#EF4444', fontWeight: '800' }}>
              {hardware.sensorPresencaPlataforma
                ? (hardware.posicionamentoCorreto ? '✓ VEÍCULO ENQUADRADO NA BALANÇA' : '⚠️ ALERTA: VEÍCULO FORA DE POSIÇÃO')
                : 'PISTA LIVRE'}
            </div>
          </div>

          {/* DESENHO GRÁFICO DA PISTA */}
          <div style={{ background: '#1A2234', border: '2px solid #374151', borderRadius: '8px', padding: '14px', position: 'relative', minHeight: '130px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* CANTO ESQUERDO: ENTRADA COM SEMÁFORO E CANCELA */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
              <span style={{ fontSize: '9px', fontWeight: '800', color: '#94A3B8' }}>ENTRADA</span>
              {/* SEMÁFORO ENTRADA */}
              <div style={{ background: '#0F172A', border: '2px solid #334155', borderRadius: '14px', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: hardware.semaforoEntrada === 'vermelho' ? '#EF4444' : '#471515', boxShadow: hardware.semaforoEntrada === 'vermelho' ? '0 0 10px #EF4444' : 'none' }}></span>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: hardware.semaforoEntrada === 'verde' ? '#10B981' : '#0B3828', boxShadow: hardware.semaforoEntrada === 'verde' ? '0 0 10px #10B981' : 'none' }}></span>
              </div>
              {/* CANCELA ENTRADA */}
              <div style={{ fontSize: '10px', color: hardware.cancelaEntrada === 'aberta' ? '#10B981' : '#EF4444', fontWeight: '800', background: '#0F172A', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${hardware.cancelaEntrada === 'aberta' ? '#10B981' : '#EF4444'}` }}>
                {hardware.cancelaEntrada === 'aberta' ? '🔓 ABERTA' : '🔒 FECHADA'}
              </div>
            </div>

            {/* PLATAFORMA CENTRAL 21M COM CAMINHÃO */}
            <div style={{ flex: 1, margin: '0 12px', background: '#0F172A', border: `2px dashed ${hardware.sensorPresencaPlataforma ? (hardware.posicionamentoCorreto ? '#10B981' : '#EF4444') : '#334155'}`, borderRadius: '6px', height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              
              {/* Linha de sensor de barreira dianteira */}
              <div style={{ position: 'absolute', left: '10px', top: 0, bottom: 0, width: '2px', background: hardware.sensorBarreiraEntrada ? '#EF4444' : 'rgba(16, 185, 129, 0.4)', boxShadow: hardware.sensorBarreiraEntrada ? '0 0 8px #EF4444' : 'none' }} title="Barreira Óptica Dianteira"></div>
              
              {/* Linha de sensor de barreira traseira */}
              <div style={{ position: 'absolute', right: '10px', top: 0, bottom: 0, width: '2px', background: hardware.sensorBarreiraSaida ? '#EF4444' : 'rgba(16, 185, 129, 0.4)', boxShadow: hardware.sensorBarreiraSaida ? '0 0 8px #EF4444' : 'none' }} title="Barreira Óptica Traseira"></div>

              {hardware.sensorPresencaPlataforma ? (
                <div style={{ textAlign: 'center', zIndex: 1 }}>
                  <div style={{ fontSize: '32px' }}>🚛</div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#00D2FF', background: '#1E293B', padding: '2px 8px', borderRadius: '4px', border: '1px solid #334155' }}>
                    {hardware.placaDetectada || 'BT-01 (RRA-4E80)'}
                  </div>
                  <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '2px' }}>
                    {hardware.veiculoAtual?.modelo || 'Caminhão Posicionado'}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#475569', fontSize: '11px' }}>
                  <div style={{ fontSize: '24px', opacity: 0.4 }}>⚖️</div>
                  <div>Plataforma 21 Metros Livre</div>
                </div>
              )}
            </div>

            {/* CANTO DIREITO: SAÍDA COM SEMÁFORO E CANCELA */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
              <span style={{ fontSize: '9px', fontWeight: '800', color: '#94A3B8' }}>SAÍDA</span>
              {/* SEMÁFORO SAÍDA */}
              <div style={{ background: '#0F172A', border: '2px solid #334155', borderRadius: '14px', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: hardware.semaforoSaida === 'vermelho' ? '#EF4444' : '#471515', boxShadow: hardware.semaforoSaida === 'vermelho' ? '0 0 10px #EF4444' : 'none' }}></span>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: hardware.semaforoSaida === 'verde' ? '#10B981' : '#0B3828', boxShadow: hardware.semaforoSaida === 'verde' ? '0 0 10px #10B981' : 'none' }}></span>
              </div>
              {/* CANCELA SAÍDA */}
              <div style={{ fontSize: '10px', color: hardware.cancelaSaida === 'aberta' ? '#10B981' : '#EF4444', fontWeight: '800', background: '#0F172A', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${hardware.cancelaSaida === 'aberta' ? '#10B981' : '#EF4444'}` }}>
                {hardware.cancelaSaida === 'aberta' ? '🔓 ABERTA' : '🔒 FECHADA'}
              </div>
            </div>
          </div>

          {/* INTERFONE & COMUNICADOR COM MOTORISTA */}
          <div style={{ marginTop: '10px', background: '#0F172A', border: '1px solid #1E293B', borderRadius: '6px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#CBD5E1' }}>
              <span>📢</span>
              <strong style={{ color: '#00D2FF' }}>Interfone CCO:</strong>
              <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>"{hardware.mensagemInterfone}"</span>
            </div>
            <button
              onClick={() => {
                const msg = prompt('Transmitir mensagem de voz ao motorista:', 'Posicione o veículo no centro e desligue o motor.');
                if (msg) executarComando('interfone_voz', { mensagem: msg });
              }}
              style={{ background: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🎙️ Falar no Totem
            </button>
          </div>
        </div>
      </div>

      {/* CONTROLES DE AUTOMAÇÃO REMOTA & SIMULADOR */}
      <div style={{ background: '#111827', border: '1px solid #1F293D', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' }}>
            🎮 Painel de Acionamento Remoto &amp; Cancelas
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>
            Acione periféricos físicos na usina em tempo real ou simule aproximações
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {/* CANCELAS */}
          <button
            onClick={() => executarComando(hardware.cancelaEntrada === 'aberta' ? 'fechar_cancela_entrada' : 'abrir_cancela_entrada')}
            style={{ background: hardware.cancelaEntrada === 'aberta' ? '#7F1D1D' : '#065F46', color: '#FFF', border: 'none', borderRadius: '6px', padding: '7px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            {hardware.cancelaEntrada === 'aberta' ? '🔒 Fechar Cancela Entrada' : '🔓 Abrir Cancela Entrada'}
          </button>
          <button
            onClick={() => executarComando('alternar_semaforo_entrada')}
            style={{ background: '#1E293B', border: '1px solid #334155', color: hardware.semaforoEntrada === 'verde' ? '#10B981' : '#EF4444', borderRadius: '6px', padding: '7px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            🚦 Semáforo Entrada ({hardware.semaforoEntrada.toUpperCase()})
          </button>
          <button
            onClick={() => executarComando(hardware.cancelaSaida === 'aberta' ? 'fechar_cancela_saida' : 'abrir_cancela_saida')}
            style={{ background: hardware.cancelaSaida === 'aberta' ? '#7F1D1D' : '#065F46', color: '#FFF', border: 'none', borderRadius: '6px', padding: '7px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            {hardware.cancelaSaida === 'aberta' ? '🔒 Fechar Cancela Saída' : '🔓 Abrir Cancela Saída'}
          </button>
          <button
            onClick={() => executarComando('alternar_semaforo_saida')}
            style={{ background: '#1E293B', border: '1px solid #334155', color: hardware.semaforoSaida === 'verde' ? '#10B981' : '#EF4444', borderRadius: '6px', padding: '7px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            🚦 Semáforo Saída ({hardware.semaforoSaida.toUpperCase()})
          </button>
        </div>

        {/* BOTÕES RÁPIDOS DO SIMULADOR */}
        <div style={{ borderTop: '1px solid #1E293B', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>Simulador de Veículos:</span>
          <button onClick={() => simularCenario('betoneira')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
            🚛 Betoneira 33.5t
          </button>
          <button onClick={() => simularCenario('cacamba_areia')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
            🚚 Scania Areia 46.2t
          </button>
          <button onClick={() => simularCenario('bitrem_insumos')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
            🚛 Bitrem Insumos 57.1t
          </button>
          <button onClick={() => simularCenario('vazio_tara')} style={{ background: '#1E293B', border: '1px solid #334155', color: '#CBD5E1', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
            🚚 Caminhão Vazio 13.2t
          </button>
          <button onClick={() => simularCenario('fora_posicao')} style={{ background: '#7F1D1D', border: '1px solid #DC2626', color: '#FFF', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
            ⚠️ Eixo Fora da Pista
          </button>
          <button onClick={() => simularCenario('liberar')} style={{ background: '#0284C7', border: 'none', color: '#FFF', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
            🏁 Liberar Pista (0 kg)
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO DE OPERAÇÃO: 1ª PESAGEM / 2ª PESAGEM / PÁTIO / HISTÓRICO */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1F293D', paddingBottom: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setAbaOperacao('segunda_pesagem')}
          style={{ background: abaOperacao === 'segunda_pesagem' ? '#0284C7' : '#111827', color: abaOperacao === 'segunda_pesagem' ? '#FFFFFF' : '#94A3B8', border: '1px solid #1F293D', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
          ⚖️ 2ª Pesagem (Saída &amp; Emissão Ticket)
        </button>
        <button
          onClick={() => setAbaOperacao('primeira_pesagem')}
          style={{ background: abaOperacao === 'primeira_pesagem' ? '#0284C7' : '#111827', color: abaOperacao === 'primeira_pesagem' ? '#FFFFFF' : '#94A3B8', border: '1px solid #1F293D', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
          🚚 1ª Pesagem (Entrada no Pátio)
        </button>
        <button
          onClick={() => setAbaOperacao('historico')}
          style={{ background: abaOperacao === 'historico' ? '#0284C7' : '#111827', color: abaOperacao === 'historico' ? '#FFFFFF' : '#94A3B8', border: '1px solid #1F293D', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
          📋 Histórico de Tickets do Dia ({tickets.length})
        </button>
      </div>

      {/* CONTEÚDO DA 2ª PESAGEM (SAÍDA) */}
      {abaOperacao === 'segunda_pesagem' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          
          {/* LISTA DE VEÍCULOS NO PÁTIO */}
          <div style={{ background: '#111827', border: '1px solid #1F293D', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>
                🚚 Veículos no Pátio Aguardando Saída ({veiculosPatio.length})
              </div>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>Selecione para finalizar</span>
            </div>

            {veiculosPatio.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', background: '#0F172A', borderRadius: '8px' }}>
                Nenhum veículo aguardando no pátio no momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
                {veiculosPatio.map(v => {
                  const sel = veiculoPatioSelecionado?.id === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => selecionarVeiculoPatio(v)}
                      style={{ background: sel ? '#1E293B' : '#0F172A', border: `1.5px solid ${sel ? '#00D2FF' : '#1F293D'}`, borderRadius: '8px', padding: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>{v.placa}</span>
                        <span style={{ fontSize: '10px', background: '#0284C7', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          Tara: {Number(v.taraEntradaKg || 0).toLocaleString('pt-BR')} kg
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                        Motorista: <strong style={{ color: '#CBD5E1' }}>{v.motorista}</strong> · {v.tipoVeiculo}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        Material: <strong style={{ color: '#00D2FF' }}>{v.produto}</strong> · Cliente: {v.cliente}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Entrada: {v.dataHoraEntrada}</span>
                        <span style={{ color: '#10B981' }}>{sel ? '● SELECIONADO NA BALANÇA' : 'Clique para pesar'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FORMULÁRIO DE FINALIZAÇÃO E CONFERÊNCIA DE PESOS */}
          <div style={{ background: '#111827', border: '1px solid #1F293D', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF', marginBottom: '12px' }}>
              ⚖️ Cálculo do Peso Líquido &amp; Emissão do Ticket 80t
            </div>

            {veiculoPatioSelecionado ? (
              <form onSubmit={salvarSegundaPesagem}>
                <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: '#94A3B8' }}>Veículo:</span>
                    <strong style={{ color: '#FFFFFF' }}>{veiculoPatioSelecionado.placa} ({veiculoPatioSelecionado.motorista})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: '#94A3B8' }}>Cliente / Destino:</span>
                    <strong style={{ color: '#FFFFFF' }}>{veiculoPatioSelecionado.cliente}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#94A3B8' }}>Material / Carga:</span>
                    <strong style={{ color: '#00D2FF' }}>{formSaida.tipoMaterial}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Peso Bruto Saída (kg)</label>
                    <input
                      type="number"
                      value={formSaida.pesoBrutoKg}
                      onChange={(e) => setFormSaida({ ...formSaida, pesoBrutoKg: Number(e.target.value) })}
                      style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#00D2FF', borderRadius: '6px', padding: '8px', fontSize: '13px', fontWeight: '700', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Tara Entrada (kg)</label>
                    <input
                      type="number"
                      value={formSaida.taraKg}
                      onChange={(e) => setFormSaida({ ...formSaida, taraKg: Number(e.target.value) })}
                      style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F59E0B', borderRadius: '6px', padding: '8px', fontSize: '13px', fontWeight: '700', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* RESUMO DOS RESULTADOS CALCULADOS */}
                <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Peso Líquido</div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: '#10B981', marginTop: '2px' }}>
                        {pesoLiquidoCalculado.toLocaleString('pt-BR')} kg
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Volume m³</div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: '#00D2FF', marginTop: '2px' }}>
                        {volumeCalculado} m³
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Valor Total</div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: '#F59E0B', marginTop: '2px' }}>
                        {fmtR(valorTotalCalculado)}
                      </div>
                    </div>
                  </div>

                  {isMineral && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1E293B', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                      <span>Taxa CFEM Mineração (1,5%):</span>
                      <strong style={{ color: '#F59E0B' }}>{fmtR(cfemCalculado)}</strong>
                    </div>
                  )}

                  {/* CONTRAN LEI DA BALANÇA */}
                  <div style={{ marginTop: '6px', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94A3B8' }}>Limite PBT CONTRAN: {limiteContranKg.toLocaleString('pt-BR')} kg</span>
                    <span style={{ color: excessoPeso > 0 ? '#EF4444' : '#10B981', fontWeight: '700' }}>
                      {excessoPeso > 0 ? `⚠️ Excesso: +${excessoPeso.toLocaleString('pt-BR')} kg` : '✓ Conforme Lei da Balança'}
                    </span>
                  </div>
                </div>

                {/* CANVAS DE ASSINATURA DIGITAL TOUCH DO MOTORISTA */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '700' }}>
                      ✍️ Assinatura Touch do Motorista na Balança
                    </label>
                    <button type="button" onClick={limparAssinatura} style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}>
                      Limpar
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={80}
                    onMouseDown={iniciarDesenho}
                    onMouseMove={desenhar}
                    onMouseUp={pararDesenho}
                    onTouchStart={iniciarDesenho}
                    onTouchMove={desenhar}
                    onTouchEnd={pararDesenho}
                    style={{ width: '100%', height: '80px', background: '#FFFFFF', borderRadius: '6px', border: '1px solid #334155', cursor: 'crosshair', touchAction: 'none' }}
                  />
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                    Assine com o dedo ou caneta touch na tela para carimbo criptográfico no ticket
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  style={{ width: '100%', background: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
                  {carregando ? 'Processando...' : '💾 Emitir Ticket de Pesagem 80t & Liberar Saída'}
                </button>
              </form>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', background: '#0F172A', borderRadius: '8px' }}>
                Selecione um caminhão na lista ao lado para realizar a pesagem de saída.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA 1ª PESAGEM (ENTRADA) */}
      {abaOperacao === 'primeira_pesagem' && (
        <div style={{ background: '#111827', border: '1px solid #1F293D', borderRadius: '10px', padding: '16px', maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF', marginBottom: '14px' }}>
            🚚 Registro da 1ª Pesagem (Entrada do Caminhão no Pátio)
          </div>

          <form onSubmit={salvarPrimeiraPesagem}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Placa do Veículo</label>
                <input
                  type="text"
                  value={formEntrada.placaVeiculo}
                  onChange={(e) => setFormEntrada({ ...formEntrada, placaVeiculo: e.target.value })}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#00D2FF', borderRadius: '6px', padding: '8px', fontSize: '13px', fontWeight: '700', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Modelo / Carroceria</label>
                <input
                  type="text"
                  value={formEntrada.modeloVeiculo}
                  onChange={(e) => setFormEntrada({ ...formEntrada, modeloVeiculo: e.target.value })}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: '6px', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Motorista</label>
                <input
                  type="text"
                  value={formEntrada.motorista}
                  onChange={(e) => setFormEntrada({ ...formEntrada, motorista: e.target.value })}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: '6px', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Transportadora</label>
                <input
                  type="text"
                  value={formEntrada.transportadora}
                  onChange={(e) => setFormEntrada({ ...formEntrada, transportadora: e.target.value })}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: '6px', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Cliente / Obra</label>
                <input
                  type="text"
                  value={formEntrada.cliente}
                  onChange={(e) => setFormEntrada({ ...formEntrada, cliente: e.target.value })}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: '6px', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Material Previsto</label>
                <select
                  value={formEntrada.tipoMaterial}
                  onChange={(e) => setFormEntrada({ ...formEntrada, tipoMaterial: e.target.value })}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: '6px', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                  <option value="Concreto Usinado Estrutural FCK 30 MPa">Concreto Usinado Estrutural FCK 30 MPa</option>
                  <option value="Areia Média Lavada de Rio (Sepotuba)">Areia Média Lavada de Rio (Sepotuba)</option>
                  <option value="Areia Grossa de Rio">Areia Grossa de Rio</option>
                  <option value="Brita 0 Granítica">Brita 0 Granítica</option>
                  <option value="Brita 1 Granítica">Brita 1 Granítica</option>
                  <option value="Cimento CP-II F 32 a Granel">Cimento CP-II F 32 a Granel</option>
                </select>
              </div>
            </div>

            <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '14px', marginBottom: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase' }}>Peso Capturado na Balança (Tara Entrada)</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#00D2FF', marginTop: '4px' }}>
                {Number(hardware.pesoAtualKg || formEntrada.taraKg).toLocaleString('pt-BR')} kg
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                Peso estabilizado no Indicador Toledo Prix 9094
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              style={{ width: '100%', background: '#0284C7', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
              {carregando ? 'Gravando...' : '📥 Registrar Entrada no Pátio & Abrir Cancela'}
            </button>
          </form>
        </div>
      )}

      {/* HISTÓRICO DE TICKETS */}
      {abaOperacao === 'historico' && (
        <div style={{ background: '#111827', border: '1px solid #1F293D', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>
              📋 Tickets de Pesagem Rodoviária Emitidos Hoje
            </div>
            <input
              type="text"
              placeholder="Buscar por placa, motorista ou cliente..."
              value={buscaTermo}
              onChange={(e) => setBuscaTermo(e.target.value)}
              style={{ background: '#0F172A', border: '1px solid #334155', color: '#FFF', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', width: '280px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0F172A', borderBottom: '2px solid #1F293D', color: '#94A3B8' }}>
                  <th style={{ padding: '10px' }}>Ticket</th>
                  <th style={{ padding: '10px' }}>Data/Hora</th>
                  <th style={{ padding: '10px' }}>Placa</th>
                  <th style={{ padding: '10px' }}>Motorista</th>
                  <th style={{ padding: '10px' }}>Material</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Peso Bruto</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Tara</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Líquido</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Volume</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tickets
                  .filter(t => !buscaTermo || t.numeroTicket?.toLowerCase().includes(buscaTermo.toLowerCase()) || t.veiculoPlaca?.toLowerCase().includes(buscaTermo.toLowerCase()) || t.motorista?.toLowerCase().includes(buscaTermo.toLowerCase()))
                  .map((t, idx) => (
                    <tr key={t.id || idx} style={{ borderBottom: '1px solid #1F293D' }}>
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: '700', color: '#00D2FF' }}>{t.numeroTicket}</td>
                      <td style={{ padding: '10px', color: '#CBD5E1' }}>{t.dataHora}</td>
                      <td style={{ padding: '10px', fontWeight: '700', color: '#FFF' }}>{t.veiculoPlaca}</td>
                      <td style={{ padding: '10px', color: '#CBD5E1' }}>{t.motorista}</td>
                      <td style={{ padding: '10px', color: '#94A3B8' }}>{t.tipoMaterial}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#CBD5E1' }}>{Number(t.pesoBrutoKg || 0).toLocaleString('pt-BR')} kg</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#F59E0B' }}>{Number(t.taraKg || 0).toLocaleString('pt-BR')} kg</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#10B981' }}>{Number(t.pesoLiquidoKg || 0).toLocaleString('pt-BR')} kg</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#00D2FF' }}>{t.volumeCalculadoM3} m³</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <button
                          onClick={() => setModalTicket(t)}
                          style={{ background: '#1E293B', border: '1px solid #334155', color: '#00D2FF', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>
                          Visualizar Ticket
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DO TICKET TÉRMICO 80MM TOLEDO */}
      {modalTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', color: '#16181B', width: '100%', maxWidth: '420px', borderRadius: '8px', padding: '18px', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'monospace' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: '900' }}>SERRANO CONCRETO &amp; MINERAÇÃO</div>
              <div style={{ fontSize: '10px', color: '#444' }}>RODOVIA MT-358 KM 08 · TANGARÁ DA SERRA - MT</div>
              <div style={{ fontSize: '10px', color: '#444' }}>CNPJ: 03.849.201/0001-10 · IE: 13.489.201-9</div>
              <div style={{ fontSize: '11px', fontWeight: '800', marginTop: '6px' }}>TICKET DE PESAGEM RODOVIÁRIA 80t</div>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#000' }}>{modalTicket.numeroTicket}</div>
              <div style={{ fontSize: '9px', color: '#666' }}>IPEM-MT / INMETRO PORTARIA 042/2026</div>
            </div>

            <div style={{ fontSize: '11px', lineHeight: 1.5, borderBottom: '1px dashed #666', paddingBottom: '8px', marginBottom: '8px' }}>
              <div><strong>DATA/HORA:</strong> {modalTicket.dataHora}</div>
              <div><strong>PLACA:</strong> {modalTicket.veiculoPlaca}</div>
              <div><strong>MOTORISTA:</strong> {modalTicket.motorista}</div>
              <div><strong>TRANSPORTADORA:</strong> {modalTicket.transportadora}</div>
              <div><strong>CLIENTE:</strong> {modalTicket.cliente}</div>
              <div><strong>MATERIAL:</strong> {modalTicket.tipoMaterial}</div>
            </div>

            <div style={{ fontSize: '12px', lineHeight: 1.6, borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>PESO BRUTO:</span>
                <strong>{Number(modalTicket.pesoBrutoKg || 0).toLocaleString('pt-BR')} kg</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>TARA:</span>
                <strong>{Number(modalTicket.taraKg || 0).toLocaleString('pt-BR')} kg</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
                <strong>PESO LÍQUIDO:</strong>
                <strong>{Number(modalTicket.pesoLiquidoKg || 0).toLocaleString('pt-BR')} kg</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>VOLUME APURADO:</span>
                <strong>{modalTicket.volumeCalculadoM3} m³</strong>
              </div>
              {modalTicket.valorCfem > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#444' }}>
                  <span>CFEM RECOLHIDO (1,5%):</span>
                  <span>{fmtR(modalTicket.valorCfem)}</span>
                </div>
              )}
            </div>

            {/* ASSINATURA */}
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#666', marginBottom: '4px' }}>Assinatura do Motorista:</div>
              {modalTicket.assinaturaMotoristaBase64 ? (
                <img src={modalTicket.assinaturaMotoristaBase64} alt="Assinatura" style={{ maxHeight: '45px', borderBottom: '1px solid #000' }} />
              ) : (
                <div style={{ borderBottom: '1px solid #000', height: '30px', margin: '0 20px' }}></div>
              )}
              <div style={{ fontSize: '10px', marginTop: '2px' }}>{modalTicket.motorista}</div>
            </div>

            <div style={{ fontSize: '8px', textAlign: 'center', color: '#666', borderTop: '1px dotted #888', paddingTop: '6px' }}>
              <div>AUTENTICIDADE: {modalTicket.codigoAutenticidade || 'BAL-TOLEDO-OFFICIAL'}</div>
              <div>Kytto ERP Industrial · Balança Rodoviária Automatizada</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={() => {
                  window.open(`/api/admin/concreto/balanca/tickets/${modalTicket.id || modalTicket.numeroTicket}/html?formato=html${token ? `&token=${encodeURIComponent(token)}` : ''}`, '_blank');
                }}
                style={{ flex: 1, background: '#000', color: '#FFF', border: 'none', borderRadius: '4px', padding: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                🖨️ Imprimir 80mm
              </button>
              <button
                onClick={() => setModalTicket(null)}
                style={{ background: '#CCC', color: '#000', border: 'none', borderRadius: '4px', padding: '10px 16px', fontSize: '12px', cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
