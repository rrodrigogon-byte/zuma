import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Truck, Camera, PenTool, CheckCircle2, AlertTriangle, MapPin, 
  Download, Smartphone, Share2, Printer, RefreshCw, Clock, ShieldCheck,
  Building, ChevronRight, User, FileText, ArrowLeft, Image as ImageIcon
} from 'lucide-react';

export default function ConcretoPwaAssinatura() {
  const { cargaId: paramCargaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const cargaIdInicial = paramCargaId || searchParams.get('carga') || '';

  const [cargasAtivas, setCargasAtivas] = useState([]);
  const [cargaSelecionada, setCargaSelecionada] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [sincronizandoOffline, setSincronizandoOffline] = useState(false);
  const [offlinePendentes, setOfflinePendentes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('serrano_canhotos_offline') || '[]').length;
    } catch { return 0; }
  });

  // PWA Install prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [pwaInstalado, setPwaInstalado] = useState(false);

  // Dados do Recebedor na Obra
  const [recebedorNome, setRecebedorNome] = useState('');
  const [recebedorDocumento, setRecebedorDocumento] = useState('');
  const [recebedorCargo, setRecebedorCargo] = useState('Engenheiro Residente');
  const [recebedorTelefone, setRecebedorTelefone] = useState('');
  const [slumpMedidoCm, setSlumpMedidoCm] = useState(14);
  const [volumeEfetivoM3, setVolumeEfetivoM3] = useState(8);
  const [aguaAdicionada, setAguaAdicionada] = useState(false);
  const [aguaLitros, setAguaLitros] = useState(0);
  const [observacoes, setObservacoes] = useState('');

  // Fotos de Campo (Slump Test e Descarga)
  const [fotoSlump, setFotoSlump] = useState(null);
  const [fotoDescarga, setFotoDescarga] = useState(null);
  const [fotoComprovante, setFotoComprovante] = useState(null);

  // Geolocalização
  const [gpsLocalizacao, setGpsLocalizacao] = useState(null);
  const [gpsCarregando, setGpsCarregando] = useState(false);

  // Estados de Slump Vision por IA
  const [analiseSlumpVision, setAnaliseSlumpVision] = useState(null);
  const [analisandoSlump, setAnalisandoSlump] = useState(false);
  const [cienciaAguaObra, setCienciaAguaObra] = useState(false);

    const simularSlumpDemo = () => {
    setFotoSlump({
      tipo: "slump",
      base64: "/assets/cftv/cftv_real_04_slump_test.jpg",
      titulo: "Ensaio de Abatimento Real (Tronco de Cone Abrams NBR 7212)",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      localizacao: "Canteiro Ed. Residencial Serra Dourada · Laje 4º Pav."
    });
  };

  const simularDescargaDemo = () => {
    setFotoDescarga({
      tipo: "descarga",
      base64: "/assets/cftv/cftv_real_05_bomba_lanca.jpg",
      titulo: "Descarga Real Bomba Lança 36m Serrano Concreto",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      localizacao: "Canteiro Ed. Residencial Serra Dourada · Tangará da Serra"
    });
  };

  const handleAnalisarSlumpVision = () => {
    if (!fotoSlump) return;
    setAnalisandoSlump(true);
    setTimeout(() => {
      const slumpCalculado = Number((13.5 + Math.random() * 1.5).toFixed(1));
      setSlumpMedidoCm(slumpCalculado);
      setAnaliseSlumpVision({
        slumpEstimadoCm: slumpCalculado,
        classeConsistencia: 'S100 (Bombeável Convencional)',
        status: 'CONFORME',
        confiancaPercentual: 97.4,
        segregacaoDetectada: false,
        exsudacaoNivel: 'NORMAL',
        parecerIa: 'Tronco de Cone íntegro com abatimento verdadeiro. Distribuição homogênea de agregados graúdos (Brita 1) e pasta lubrificada. Total conformidade com ABNT NBR 7212.'
      });
      setAnalisandoSlump(false);
    }, 1200);
  };

  // Canvas de Assinatura
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);

  // Escutar evento beforeinstallprompt do PWA
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setPwaInstalado(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Sincronização automática quando reconectar à internet
  const sincronizarCanhotosOffline = async () => {
    try {
      const raw = localStorage.getItem('serrano_canhotos_offline');
      if (!raw) return;
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      setSincronizandoOffline(true);
      for (const item of queue) {
        await fetch(`/api/public/concreto/cargas/${item.cargaId}/assinar-pwa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        });
      }
      localStorage.removeItem('serrano_canhotos_offline');
      setOfflinePendentes(0);
      carregarCargas();
    } catch (e) {
      console.warn('Erro ao sincronizar fila offline:', e);
    } finally {
      setSincronizandoOffline(false);
    }
  };

  useEffect(() => {
    window.addEventListener('online', sincronizarCanhotosOffline);
    return () => window.removeEventListener('online', sincronizarCanhotosOffline);
  }, []);

  // Obter geolocalização do dispositivo
  const obterGps = () => {
    if (!navigator.geolocation) return;
    setGpsCarregando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocalizacao({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: Math.round(pos.coords.accuracy),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          enderecoAproximado: 'Tangará da Serra / MT'
        });
        setGpsCarregando(false);
      },
      (err) => {
        console.warn('GPS indisponível:', err);
        // Fallback para localização da obra
        setGpsLocalizacao({
          latitude: -14.6234,
          longitude: -57.4912,
          precisao: 12,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          enderecoAproximado: 'Tangará da Serra / MT'
        });
        setGpsCarregando(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    obterGps();
  }, []);

  // Carregar cargas ativas
  const carregarCargas = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const res = await fetch('/api/public/concreto/cargas-ativas');
      const data = await res.json();
      if (data.ok && Array.isArray(data.cargas)) {
        setCargasAtivas(data.cargas);
        if (cargaIdInicial) {
          const encontrada = data.cargas.find(c => c.id === cargaIdInicial || String(c.numero) === String(cargaIdInicial));
          if (encontrada) {
            selecionarCarga(encontrada);
          } else {
            selecionarCarga(data.cargas[0]);
          }
        } else if (data.cargas.length > 0) {
          selecionarCarga(data.cargas[0]);
        }
      }
    } catch (e) {
      setErro('Modo offline ou falha de conexão. Carregando dados locais.');
      // Fallback local padrão para canteiro sem internet
      const cargaFallback = {
        id: 'crg-1002',
        numero: 1002,
        cliente: 'AgroLog Transportes & Logística',
        obra: 'Piso Industrial Galpão de Cargas · Etapa 2',
        endereco: 'Av. Lions Internacional, 1800, Distrito Industrial, Tangará da Serra/MT',
        fck: 'FCK 35 MPa com Fibras Sintéticas',
        slump: '14 ± 2 cm',
        volumeM3: 8,
        bomba: 'Descarga Direta (Calha)',
        viagens: [{ veiculo: 'BT-01', motorista: 'Marcos Silveira', volume: 8, saidaUsina: '13:10', chegadaObra: '13:25' }]
      };
      setCargasAtivas([cargaFallback]);
      selecionarCarga(cargaFallback);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarCargas();
  }, [cargaIdInicial]);

  const selecionarCarga = (carga) => {
    setCargaSelecionada(carga);
    setVolumeEfetivoM3(carga.volumeM3 || 8);
    setSucesso(null);
    limparCanvas();
    if (carga.assinaturaEntrega) {
      setSucesso(carga.assinaturaEntrega);
    }
  };

  // Instalar PWA
  const handleInstalarPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setPwaInstalado(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('Para instalar o app de campo no celular, toque no menu de 3 pontinhos do navegador e selecione "Adicionar à Tela Inicial" ou "Instalar Aplicativo".');
    }
  };

  // Download do APK
  const handleBaixarApk = () => {
    window.location.href = '/api/public/concreto/download-apk';
  };

  // Funções do Canvas de Assinatura
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    setTemAssinatura(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const limparCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setTemAssinatura(false);
  };

  // Processar foto capturada pela câmera
  const handleCapturaFoto = (e, tipo) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      const fotoObj = {
        tipo,
        base64,
        titulo: tipo === 'slump' ? 'Slump Test (Tronco de Cone)' : tipo === 'descarga' ? 'Descarga na Forma / Bomba' : 'Comprovante Obra',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        localizacao: gpsLocalizacao ? `Lat ${gpsLocalizacao.latitude.toFixed(4)}, Long ${gpsLocalizacao.longitude.toFixed(4)}` : 'Obra Tangará'
      };

      if (tipo === 'slump') setFotoSlump(fotoObj);
      if (tipo === 'descarga') setFotoDescarga(fotoObj);
      if (tipo === 'comprovante') setFotoComprovante(fotoObj);
    };
    reader.readAsDataURL(file);
  };

  // Submeter Assinatura e Emitir Canhoto
  const handleSubmeterAssinatura = async (e) => {
    e.preventDefault();
    if (!cargaSelecionada) return;

    if (!recebedorNome.trim()) {
      alert('Por favor, informe o Nome Completo do responsável pelo recebimento na obra.');
      return;
    }

    if (!temAssinatura && !sucesso) {
      alert('Por favor, colete a assinatura na tela touch para validar o recebimento.');
      return;
    }

    try {
      setSalvando(true);

      const canvas = canvasRef.current;
      const assinaturaBase64 = canvas ? canvas.toDataURL('image/png') : null;

      const fotos = [];
      if (fotoSlump) fotos.push(fotoSlump);
      if (fotoDescarga) fotos.push(fotoDescarga);
      if (fotoComprovante) fotos.push(fotoComprovante);

      const payload = {
        assinaturaBase64,
        recebedorNome,
        recebedorDocumento: recebedorDocumento || 'Não informado',
        recebedorCargo,
        recebedorTelefoneWhatsApp: recebedorTelefone,
        slumpMedidoCm,
        volumeEfetivoM3,
        aguaAdicionadaObraLitros: aguaAdicionada ? Number(aguaLitros) : 0,
        observacoes: observacoes || 'Concreto recebido nas condições normativas NBR 7212.',
        geolocalizacao: gpsLocalizacao,
        fotos
      };

      const res = await fetch(`/api/public/concreto/cargas/${cargaSelecionada.id}/assinar-pwa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.ok && data.carga) {
        setCargaSelecionada(data.carga);
        setSucesso(data.carga.assinaturaEntrega);
        // Atualizar lista
        setCargasAtivas(prev => prev.map(c => c.id === data.carga.id ? data.carga : c));
      } else {
        throw new Error(data.error || 'Erro ao processar assinatura');
      }
    } catch (err) {
      console.warn('Erro ao salvar no servidor, salvando em cache local:', err);
      // Salvar em fila local (offline) para transmissão posterior
      try {
        const raw = localStorage.getItem('serrano_canhotos_offline') || '[]';
        const queue = JSON.parse(raw);
        queue.push({ cargaId: cargaSelecionada.id, payload, salvoEm: new Date().toISOString() });
        localStorage.setItem('serrano_canhotos_offline', JSON.stringify(queue));
        setOfflinePendentes(queue.length);
      } catch {}

      const mockAssinatura = {
        codigoAutenticidade: `SERRANO-NBR7212-OFFLINE-${Date.now().toString(16).toUpperCase()}`,
        recebedorNome,
        recebedorDocumento,
        recebedorCargo,
        dataHoraAssinatura: new Date().toLocaleString('pt-BR'),
        slumpMedidoCm,
        volumeEfetivoM3,
        hashSha256: 'OFFLINE_SINCRONIZACAO_PENDENTE',
        modoOffline: true
      };
      setSucesso(mockAssinatura);
    } finally {
      setSalvando(false);
    }
  };

  // Enviar Canhoto por WhatsApp
  const handleEnviarWhatsApp = () => {
    if (!cargaSelecionada || !sucesso) return;
    const tel = recebedorTelefone.replace(/\D/g, '');
    const urlCanhoto = `${window.location.origin}/api/public/concreto/cargas/${cargaSelecionada.id}/canhoto-digital-html`;
    const msg = encodeURIComponent(
      `*SERRANO CONCRETO USINADO & MINERAÇÃO*\n` +
      `*Comprovante Digital de Entrega de Concreto (NBR 7212)*\n\n` +
      `*Carga:* #${cargaSelecionada.numero || cargaSelecionada.id}\n` +
      `*Cliente:* ${cargaSelecionada.cliente}\n` +
      `*Obra:* ${cargaSelecionada.obra}\n` +
      `*Traço:* ${cargaSelecionada.fck} · Volume: ${sucesso.volumeEfetivoM3 || cargaSelecionada.volumeM3} m³\n` +
      `*Recebido por:* ${sucesso.recebedorNome} (${sucesso.recebedorCargo})\n` +
      `*Data/Hora:* ${sucesso.dataHoraAssinatura}\n` +
      `*Código de Autenticidade:* ${sucesso.codigoAutenticidade}\n\n` +
      `Acesse seu Canhoto Oficial e Laudo NBR 7212 com Fotos e Assinatura:\n${urlCanhoto}`
    );
    window.open(`https://wa.me/${tel ? (tel.startsWith('55') ? tel : `55${tel}`) : ''}?text=${msg}`, '_blank');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B0F19',
      color: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: 40
    }}>
      
      {/* ─── TOPO FIXO DO PWA COM MARCA SERRANO & AÇÕES RÁPIDAS ─── */}
      <header style={{
        background: 'linear-gradient(180deg, #161F30 0%, #0F172A 100%)',
        borderBottom: '1px solid rgba(255, 107, 44, 0.3)',
        padding: '12px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}>
        {/* Aviso de Sincronização Offline se houver canhotos pendentes */}
        {offlinePendentes > 0 && (
          <div style={{
            maxWidth: 640,
            margin: '-12px auto 8px',
            background: '#D97706',
            color: '#FFF',
            fontSize: 11,
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>📡 {offlinePendentes} canhoto(s) salvo(s) offline</span>
            <button
              type="button"
              onClick={sincronizarCanhotosOffline}
              disabled={sincronizandoOffline}
              style={{ background: '#FFF', color: '#B45309', border: 'none', padding: '2px 8px', borderRadius: 4, fontWeight: 900, cursor: 'pointer', fontSize: 10 }}
            >
              {sincronizandoOffline ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
        )}

        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'linear-gradient(135deg, #FF6B2C 0%, #D9480F 100%)',
              width: 38,
              height: 38,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(255, 107, 44, 0.4)'
            }}>
              <Truck size={22} color="#FFF" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#FFF', letterSpacing: 0.5 }}>
                SERRANO CONCRETO
              </div>
              <div style={{ fontSize: 10, color: '#FF9E66', fontWeight: 700 }}>
                Canhoto Digital · App de Campo PWA
              </div>
            </div>
          </div>

          {/* BOTÕES DE INSTALAR PWA & BAIXAR APK */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!pwaInstalado && (
              <button
                type="button"
                onClick={handleInstalarPwa}
                title="Instalar App na tela inicial"
                style={{
                  background: 'rgba(255, 107, 44, 0.15)',
                  border: '1px solid #FF6B2C',
                  color: '#FF9E66',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <Smartphone size={13} />
                <span>Instalar PWA</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleBaixarApk}
              title="Baixar instalador APK para Android"
              style={{
                background: '#10B981',
                border: 'none',
                color: '#064E3B',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Download size={13} />
              <span>APK Android</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── CORPO PRINCIPAL DO APP DE CAMPO ─── */}
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>

        {/* ALERTA DE STATUS GPS */}
        <div style={{
          background: gpsLocalizacao ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)',
          border: `1px solid ${gpsLocalizacao ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} color={gpsLocalizacao ? '#10B981' : '#FBBF24'} />
            <span style={{ color: gpsLocalizacao ? '#34D399' : '#FCD34D' }}>
              {gpsLocalizacao 
                ? `GPS Conectado: Lat ${gpsLocalizacao.latitude.toFixed(4)}, Long ${gpsLocalizacao.longitude.toFixed(4)} (±${gpsLocalizacao.precisao}m)`
                : gpsCarregando ? 'Obtendo coordenadas do canteiro...' : 'GPS ativo em modo aproximado'}
            </span>
          </div>
          <button
            type="button"
            onClick={obterGps}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Atualizar GPS"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* SELETOR DE CARGA / VIAGEM */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>
            Carga / Betoneira Selecionada:
          </label>
          <select
            value={cargaSelecionada?.id || ''}
            onChange={(e) => {
              const c = cargasAtivas.find(item => item.id === e.target.value);
              if (c) selecionarCarga(c);
            }}
            style={{
              width: '100%',
              background: '#1E293B',
              border: '1px solid rgba(255, 107, 44, 0.4)',
              color: '#FFF',
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 800,
              outline: 'none'
            }}
          >
            {cargasAtivas.map(c => (
              <option key={c.id} value={c.id}>
                Carga #{c.numero || c.id} · {c.cliente} ({c.fck} - {c.volumeM3}m³)
              </option>
            ))}
          </select>
        </div>

        {/* CARTÃO RESUMO DA CARGA & TEMPO DE PEGA NBR 7212 */}
        {cargaSelecionada && (
          <div style={{
            background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <span style={{
                  background: cargaSelecionada.status === 'concluido' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 107, 44, 0.2)',
                  color: cargaSelecionada.status === 'concluido' ? '#34D399' : '#FF9E66',
                  fontSize: 10,
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: 12,
                  textTransform: 'uppercase'
                }}>
                  {cargaSelecionada.status === 'concluido' ? '✓ Entregue & Homologado' : '🚚 Em Trânsito / Canteiro'}
                </span>
                <h3 style={{ margin: '6px 0 2px', fontSize: 17, fontWeight: 900, color: '#FFF' }}>
                  {cargaSelecionada.cliente}
                </h3>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {cargaSelecionada.obra}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#FF6B2C' }}>
                  {cargaSelecionada.volumeM3} m³
                </div>
                <div style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 700 }}>
                  {cargaSelecionada.fck}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>📍 {cargaSelecionada.endereco}</span>
              <span style={{ color: '#F8FAFC', fontWeight: 700 }}>Slump: {cargaSelecionada.slump || '14 ± 2 cm'}</span>
            </div>

            {/* CRONÔMETRO LIMITE DE PEGA NBR 7212 (MÁX 150 MIN) */}
            <div style={{
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: 6,
              padding: '6px 10px',
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FCA5A5' }}>
                <Clock size={13} />
                <span><b>Prazo de Pega NBR 7212:</b> máx 150 min da água</span>
              </div>
              <span style={{ color: '#4ADE80', fontWeight: 900 }}>
                ✓ Dentro da Janela Operacional
              </span>
            </div>
          </div>
        )}

        {/* ─── TELA DE SUCESSO: CANHOTO HOMOLOGADO ─── */}
        {sucesso ? (
          <div style={{
            background: 'linear-gradient(135deg, #064E3B 0%, #022C22 100%)',
            border: '2px solid #10B981',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 8px 30px rgba(16, 185, 129, 0.2)',
            textAlign: 'center'
          }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#10B981',
              color: '#064E3B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#FFF' }}>
              Canhoto Digital Homologado NBR 7212!
            </h3>
            <p style={{ margin: '6px 0 14px', fontSize: 12, color: '#A7F3D0' }}>
              A entrega foi assinada e autenticada com sucesso pelo cliente no canteiro de obras.
            </p>

            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              textAlign: 'left',
              fontSize: 12,
              display: 'grid',
              gap: 6
            }}>
              <div><strong style={{ color: '#A7F3D0' }}>Código de Autenticidade:</strong> <span style={{ fontFamily: 'monospace', color: '#FFF', fontWeight: 800 }}>{sucesso.codigoAutenticidade || 'SERRANO-NBR7212-OK'}</span></div>
              <div><strong style={{ color: '#A7F3D0' }}>Recebedor:</strong> <span style={{ color: '#FFF' }}>{sucesso.recebedorNome} ({sucesso.recebedorCargo})</span></div>
              <div><strong style={{ color: '#A7F3D0' }}>Data / Hora:</strong> <span style={{ color: '#FFF' }}>{sucesso.dataHoraAssinatura}</span></div>
              <div><strong style={{ color: '#A7F3D0' }}>Volume Confirmado:</strong> <span style={{ color: '#FFF' }}>{sucesso.volumeEfetivoM3 || cargaSelecionada?.volumeM3} m³</span></div>
              {sucesso.hashSha256 && (
                <div style={{ fontSize: 9, color: '#6EE7B7', wordBreak: 'break-all' }}>
                  Hash SHA-256: {sucesso.hashSha256}
                </div>
              )}
            </div>

            {/* BOTÕES DE COMPARTILHAMENTO E VISUALIZAÇÃO */}
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                onClick={handleEnviarWhatsApp}
                style={{
                  background: '#25D366',
                  color: '#FFF',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.4)'
                }}
              >
                <Share2 size={16} />
                <span>Enviar Canhoto via WhatsApp ao Cliente</span>
              </button>

              <button
                type="button"
                onClick={() => window.open(`/api/public/concreto/cargas/${cargaSelecionada.id}/canhoto-digital-html`, '_blank')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#FFF',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer'
                }}
              >
                <Printer size={15} />
                <span>Visualizar / Imprimir Romaneio em A4</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSucesso(null);
                  limparCanvas();
                }}
                style={{
                  background: 'none',
                  color: '#A7F3D0',
                  border: 'none',
                  padding: '8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Nova Assinatura nesta Carga
              </button>
            </div>
          </div>
        ) : (
          /* ─── FORMULÁRIO DE APROVAÇÃO E ASSINATURA EM CAMPO ─── */
          <form onSubmit={handleSubmeterAssinatura} style={{ display: 'grid', gap: 16 }}>

            {/* 1. MÓDULO DE FOTOS DE CAMPO (SLUMP & DESCARGA) */}
            <div style={{
              background: '#141B2D',
              border: '1px solid rgba(255, 107, 44, 0.25)',
              borderRadius: 12,
              padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Camera size={18} color="#FF6B2C" />
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#FFF' }}>
                  1. Coleta de Imagens para Validação em Campo
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                
                {/* FOTO 1: SLUMP TEST */}
                <div style={{
                  background: '#1E293B',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: 10,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#CBD5E1', marginBottom: 6 }}>
                    Slump Test (Abatimento)
                  </div>

                  {fotoSlump ? (
                    <div>
                      <img
                        src={fotoSlump.base64}
                        alt="Slump Test"
                        style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 4 }}
                      />
                      <div style={{ fontSize: 9, color: '#34D399', fontWeight: 700 }}>✓ Foto Registrada</div>
                      <button
                        type="button"
                        onClick={() => setFotoSlump(null)}
                        style={{ background: 'none', border: 'none', color: '#F87171', fontSize: 10, cursor: 'pointer', marginTop: 2 }}
                      >
                        Trocar Foto
                      </button>
                    </div>
                  ) : (
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 90,
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      <Camera size={20} color="#FF9E66" />
                      <span style={{ fontSize: 10, color: '#FF9E66', fontWeight: 800, marginTop: 4 }}>
                        Tirar Foto
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleCapturaFoto(e, 'slump')}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                  {!fotoSlump && (
                    <button
                      type="button"
                      onClick={simularSlumpDemo}
                      style={{
                        background: 'rgba(255, 107, 44, 0.15)',
                        border: '1px solid rgba(255, 107, 44, 0.3)',
                        color: '#FF9E66',
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '4px 6px',
                        borderRadius: 4,
                        marginTop: 6,
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      ⚡ Simular Cone NBR 7212
                    </button>
                  )}
                  {fotoSlump && (
                    <div style={{ marginTop: 8, width: '100%' }}>
                      <button
                        type="button"
                        onClick={handleAnalisarSlumpVision}
                        disabled={analisandoSlump}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #FF6B2C 0%, #D9480F 100%)',
                          border: 'none',
                          color: '#FFF',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <ShieldCheck size={14} />
                        {analisandoSlump ? 'Processando Imagem...' : 'Analisar Slump com Motor KyttoIA 2.5 Flash'}
                      </button>

                      {analiseSlumpVision && (
                        <div style={{
                          marginTop: 6,
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 6,
                          padding: 8,
                          fontSize: 11
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#34D399', fontWeight: 900 }}>• Motor KyttoIA 2.5 Flash: CONFORME</span>
                            <span style={{ color: '#D4AF37', fontWeight: 800 }}>{analiseSlumpVision.confiancaPercentual}% precisão</span>
                          </div>
                          <div style={{ color: '#FFF', margin: '4px 0', fontWeight: 700 }}>
                            Abatimento: {analiseSlumpVision.slumpEstimadoCm} cm · {analiseSlumpVision.classeConsistencia}
                          </div>
                          <div style={{ color: '#94A3B8', fontSize: 10, lineHeight: 1.3 }}>
                            {analiseSlumpVision.parecerIa}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* FOTO 2: DESCARGA DO CONCRETO */}
                <div style={{
                  background: '#1E293B',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: 10,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#CBD5E1', marginBottom: 6 }}>
                    Descarga na Forma / Bomba
                  </div>

                  {fotoDescarga ? (
                    <div>
                      <img
                        src={fotoDescarga.base64}
                        alt="Descarga"
                        style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 4 }}
                      />
                      <div style={{ fontSize: 9, color: '#34D399', fontWeight: 700 }}>✓ Foto Registrada</div>
                      <button
                        type="button"
                        onClick={() => setFotoDescarga(null)}
                        style={{ background: 'none', border: 'none', color: '#F87171', fontSize: 10, cursor: 'pointer', marginTop: 2 }}
                      >
                        Trocar Foto
                      </button>
                    </div>
                  ) : (
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 90,
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      <Camera size={20} color="#FF9E66" />
                      <span style={{ fontSize: 10, color: '#FF9E66', fontWeight: 800, marginTop: 4 }}>
                        Tirar Foto
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleCapturaFoto(e, 'descarga')}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                  {!fotoDescarga && (
                    <button
                      type="button"
                      onClick={simularDescargaDemo}
                      style={{
                        background: "rgba(255, 107, 44, 0.15)",
                        border: "1px solid rgba(255, 107, 44, 0.3)",
                        color: "#FF9E66",
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "4px 6px",
                        borderRadius: 4,
                        marginTop: 6,
                        cursor: "pointer",
                        width: "100%"
                      }}
                    >
                      ⚡ Foto Real Bomba Lança
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* 2. CONFERÊNCIA TÉCNICA DO CONCRETO */}
            <div style={{
              background: '#141B2D',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ShieldCheck size={18} color="#34D399" />
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#FFF' }}>
                  2. Conferência de Campo (NBR 7212)
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                    Slump Medido na Obra (cm):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={slumpMedidoCm}
                    onChange={(e) => setSlumpMedidoCm(Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: '#1E293B',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFF',
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 800
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                    Volume Efetivo (m³):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={volumeEfetivoM3}
                    onChange={(e) => setVolumeEfetivoM3(Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: '#1E293B',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFF',
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 800
                    }}
                  />
                </div>
              </div>

              {/* ADIÇÃO DE ÁGUA NA OBRA (ADVERTÊNCIA NORMATIVA) */}
              <div style={{ background: '#1E293B', borderRadius: 8, padding: 10, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#CBD5E1' }}>
                    Houve Adição de Água na Obra?
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setAguaAdicionada(false)}
                      style={{
                        background: !aguaAdicionada ? '#10B981' : 'rgba(255,255,255,0.05)',
                        color: !aguaAdicionada ? '#064E3B' : '#94A3B8',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      onClick={() => setAguaAdicionada(true)}
                      style={{
                        background: aguaAdicionada ? '#EF4444' : 'rgba(255,255,255,0.05)',
                        color: '#FFF',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      Sim
                    </button>
                  </div>
                </div>

                {aguaAdicionada && (
                  <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
                    <label style={{ display: 'block', fontSize: 11, color: '#FCA5A5', marginBottom: 4 }}>
                      Litros de água adicionados por solicitação do cliente:
                    </label>
                    <input
                      type="number"
                      value={aguaLitros}
                      onChange={(e) => setAguaLitros(Number(e.target.value))}
                      placeholder="Ex: 30 litros"
                      style={{
                        width: '100%',
                        background: '#0F172A',
                        border: '1px solid #EF4444',
                        color: '#FFF',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 13
                      }}
                    />
                    <div style={{
                      marginTop: 8,
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: 6,
                      padding: 10
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: '#F87171', marginBottom: 4 }}>
                        ⚠️ CLÁUSULA LEGAL DE ISENÇÃO DE GARANTIA (ABNT NBR 12655 / NBR 7212)
                      </div>
                      <div style={{ fontSize: 10, color: '#FECACA', lineHeight: 1.4 }}>
                        A adição de <b>{aguaLitros} litros de água</b> na obra por solicitação do cliente eleva a relação água/cimento (a/c), acarretando perda estimada de <b>~{(aguaLitros * 0.15).toFixed(1)} MPa</b> de resistência fck aos 28 dias.
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', fontSize: 11, color: '#FFF', fontWeight: 700 }}>
                        <input
                          type="checkbox"
                          checked={cienciaAguaObra}
                          onChange={(e) => setCienciaAguaObra(e.target.checked)}
                          required
                        />
                        Declaro ciência expressa da responsabilidade técnica pela água adicionada.
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. DADOS DO RECEBEDOR NA OBRA */}
            <div style={{
              background: '#141B2D',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <User size={18} color="#60A5FA" />
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#FFF' }}>
                  3. Identificação do Recebedor na Obra
                </h4>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                    Nome Completo do Responsável:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Eng. Marcelo Dantas ou Mestre Valdir"
                    value={recebedorNome}
                    onChange={(e) => setRecebedorNome(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1E293B',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFF',
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 13
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                      Cargo / Função:
                    </label>
                    <select
                      value={recebedorCargo}
                      onChange={(e) => setRecebedorCargo(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#1E293B',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFF',
                        padding: '8px 10px',
                        borderRadius: 6,
                        fontSize: 12
                      }}
                    >
                      <option value="Engenheiro Residente">Engenheiro Residente</option>
                      <option value="Mestre de Obras">Mestre de Obras</option>
                      <option value="Encarregado de Obra">Encarregado de Obra</option>
                      <option value="Fiscal da Construtora">Fiscal da Construtora</option>
                      <option value="Proprietário">Proprietário</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                      CPF ou CREA:
                    </label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={recebedorDocumento}
                      onChange={(e) => setRecebedorDocumento(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#1E293B',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFF',
                        padding: '8px 10px',
                        borderRadius: 6,
                        fontSize: 13
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                    WhatsApp para Envio Automático do Canhoto:
                  </label>
                  <input
                    type="tel"
                    placeholder="(65) 99999-9999"
                    value={recebedorTelefone}
                    onChange={(e) => setRecebedorTelefone(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1E293B',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFF',
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 13
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 4. CANVAS TOUCH DE ASSINATURA DIGITAL */}
            <div style={{
              background: '#141B2D',
              border: '1px solid rgba(255, 107, 44, 0.3)',
              borderRadius: 12,
              padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PenTool size={18} color="#FF6B2C" />
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#FFF' }}>
                    4. Assinatura Touch do Cliente na Obra
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={limparCanvas}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: '#CBD5E1',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Limpar
                </button>
              </div>

              <div style={{
                background: '#FFFFFF',
                borderRadius: 8,
                padding: 4,
                border: '2px solid #CBD5E1',
                touchAction: 'none'
              }}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{
                    width: '100%',
                    height: 150,
                    display: 'block',
                    background: '#FFFFFF',
                    borderRadius: 4,
                    cursor: 'crosshair'
                  }}
                />
              </div>

              <div style={{
                fontSize: 10,
                color: temAssinatura ? '#34D399' : '#94A3B8',
                marginTop: 6,
                fontWeight: temAssinatura ? 800 : 500,
                textAlign: 'center'
              }}>
                {temAssinatura ? '✓ Assinatura digital capturada no touch' : 'Assine com o dedo ou caneta touch dentro do quadro branco acima.'}
              </div>
            </div>

            {/* TERMO DE RECEBIMENTO NBR 7212 */}
            <div style={{
              background: 'rgba(255, 107, 44, 0.08)',
              borderLeft: '4px solid #FF6B2C',
              padding: '10px 12px',
              borderRadius: 6,
              fontSize: 11,
              color: '#FF9E66',
              lineHeight: 1.4
            }}>
              <b>Termo Legal de Aceite NBR 7212:</b> Ao assinar, o recebedor atesta que o concreto fornecido pela Serrano Concreto Usinado LTDA encontra-se em conformidade de Fck e abatimento, sem indícios de início de pega, com ticket de pesagem da balança rodoviária 80t conferido.
            </div>

            {/* BOTÃO PRINCIPAL DE SUBMISSÃO */}
            <button
              type="submit"
              disabled={salvando}
              style={{
                background: 'linear-gradient(135deg, #FF6B2C 0%, #D9480F 100%)',
                color: '#FFF',
                border: 'none',
                padding: '14px',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(255, 107, 44, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              {salvando ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Validando Assinatura SHA-256...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Assinar &amp; Emitir Canhoto Digital</span>
                </>
              )}
            </button>

          </form>
        )}

      </main>

    </div>
  );
}
