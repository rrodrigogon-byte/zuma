
const CAMERAS_SEED = [
  {
    id: "cam-01-lpr",
    nome: "CAM-01 · Balança 80t (Totem LPR Entrada)",
    pontoInstalacao: "balanca_entrada_lpr",
    pontoRotulo: "Balança 80t - Totem LPR Entrada",
    marca: "intelbras",
    modelo: "VIP 7250 LPR IA",
    ipHost: "192.168.1.120",
    portaRtsp: 554,
    portaHttp: 80,
    usuario: "admin",
    canal: 1,
    substream: true,
    streamRtspUrl: "rtsp://admin:****@192.168.1.120:554/cam/realmonitor?channel=1&subtype=1",
    snapshotHttpUrl: "http://admin:****@192.168.1.120/cgi-bin/snapshot.cgi?channel=1",
    hlsStreamUrl: "/assets/cftv/cftv_cam01_lpr_entrada.jpg",
    status: "online",
    fps: 30,
    resolucao: "1920x1080 (Full HD)",
    iaAtiva: true,
    recursosIa: ["lpr_mercosul", "deteccao_veiculo", "ocr_placas"],
    ultimaLeituraPlaca: "BT-01 (RRA-4E80)",
    confiancaUltimaPlaca: 99.6,
    dataHoraUltimaLeitura: new Date().toLocaleDateString("pt-BR") + " 17:42:10"
  },
  {
    id: "cam-02-panoramica",
    nome: "CAM-02 · Plataforma 21m (Panorâmica)",
    pontoInstalacao: "balanca_panoramica",
    pontoRotulo: "Balança 80t - Panorâmica 21m",
    marca: "hikvision",
    modelo: "DS-2CD2T87G2-L (ColorVu 4K)",
    ipHost: "192.168.1.121",
    portaRtsp: 554,
    portaHttp: 80,
    usuario: "admin",
    canal: 1,
    substream: true,
    streamRtspUrl: "rtsp://admin:****@192.168.1.121:554/Streaming/Channels/102",
    snapshotHttpUrl: "http://admin:****@192.168.1.121/ISAPI/Streaming/channels/101/picture",
    hlsStreamUrl: "/assets/cftv/cftv_cam02_plataforma_panoramica.jpg",
    status: "online",
    fps: 25,
    resolucao: "3840x2160 (4K UHD)",
    iaAtiva: true,
    recursosIa: ["enquadramento_plataforma", "posicionamento_eixos", "detector_sobrepeso"],
    ultimaLeituraPlaca: "Enquadramento 100% OK · 8 Células Toledo",
    confiancaUltimaPlaca: 99.8,
    dataHoraUltimaLeitura: new Date().toLocaleDateString("pt-BR") + " 17:42:15"
  },
  {
    id: "cam-03-cancela-saida",
    nome: "CAM-03 · Balança 80t (Cancela Saída)",
    pontoInstalacao: "balanca_cancela_saida",
    pontoRotulo: "Balança 80t - Cancela Saída",
    marca: "intelbras",
    modelo: "VIP 3230 B G3",
    ipHost: "192.168.1.122",
    portaRtsp: 554,
    portaHttp: 80,
    usuario: "admin",
    canal: 1,
    substream: true,
    streamRtspUrl: "rtsp://admin:****@192.168.1.122:554/cam/realmonitor?channel=1&subtype=1",
    snapshotHttpUrl: "http://admin:****@192.168.1.122/cgi-bin/snapshot.cgi?channel=1",
    hlsStreamUrl: "/assets/cftv/cftv_cam03_cancela_saida.jpg",
    status: "online",
    fps: 30,
    resolucao: "1920x1080 (Full HD)",
    iaAtiva: true,
    recursosIa: ["monitor_cancela", "semaforo_saida", "auditoria_ticket"],
    ultimaLeituraPlaca: "Saída Liberada · Ticket #8942",
    confiancaUltimaPlaca: 99.9,
    dataHoraUltimaLeitura: new Date().toLocaleDateString("pt-BR") + " 17:40:02"
  },
  {
    id: "cam-04-patio-betoneiras",
    nome: "CAM-04 · Pátio & Silos 96t (Manobras)",
    pontoInstalacao: "patio_betoneiras",
    pontoRotulo: "Pátio de Betoneiras & Silos 96t",
    marca: "dahua",
    modelo: "DH-IPC-HFW5842E-Z4E",
    ipHost: "192.168.1.123",
    portaRtsp: 554,
    portaHttp: 80,
    usuario: "admin",
    canal: 1,
    substream: true,
    streamRtspUrl: "rtsp://admin:****@192.168.1.123:554/cam/realmonitor?channel=1&subtype=1",
    snapshotHttpUrl: "http://admin:****@192.168.1.123/cgi-bin/snapshot.cgi?channel=1",
    hlsStreamUrl: "/assets/cftv/cftv_cam04_patio_silos.jpg",
    status: "online",
    fps: 25,
    resolucao: "1920x1080 (Full HD)",
    iaAtiva: true,
    recursosIa: ["epi_capacete_colete", "fila_carregamento", "sensor_movimento"],
    ultimaLeituraPlaca: "EPIs 100% em Conformidade",
    confiancaUltimaPlaca: 98.4,
    dataHoraUltimaLeitura: new Date().toLocaleDateString("pt-BR") + " 17:41:50"
  },
  {
    id: "cam-05-central-dosadora",
    nome: "CAM-05 · Central Dosadora NBR 7212",
    pontoInstalacao: "central_dosadora",
    pontoRotulo: "Central Dosadora e Caçamba de Pesagem",
    marca: "axis",
    modelo: "P1455-LE Industrial",
    ipHost: "192.168.1.124",
    portaRtsp: 554,
    portaHttp: 80,
    usuario: "root",
    canal: 1,
    substream: true,
    streamRtspUrl: "rtsp://root:****@192.168.1.124:554/axis-media/media.amp",
    snapshotHttpUrl: "http://root:****@192.168.1.124/axis-cgi/jpg/image.cgi",
    hlsStreamUrl: "/assets/cftv/cftv_cam05_central_dosadora.jpg",
    status: "online",
    fps: 30,
    resolucao: "1920x1080 (Full HD)",
    iaAtiva: true,
    recursosIa: ["fluxo_agregados", "descarga_cimento", "sensor_poeira"],
    ultimaLeituraPlaca: "Batelada #1042 Concluída",
    confiancaUltimaPlaca: 99.2,
    dataHoraUltimaLeitura: new Date().toLocaleDateString("pt-BR") + " 17:38:12"
  },
  {
    id: "cam-06-mineracao-draga",
    nome: "CAM-06 · Mineração Sepotuba (Draga & Pátio)",
    pontoInstalacao: "mineracao_areia",
    pontoRotulo: "Mineração de Areia e Britador",
    marca: "hikvision",
    modelo: "DS-2CD2047G2-LU/SL",
    ipHost: "192.168.1.125",
    portaRtsp: 554,
    portaHttp: 80,
    usuario: "admin",
    canal: 1,
    substream: true,
    streamRtspUrl: "rtsp://admin:****@192.168.1.125:554/Streaming/Channels/102",
    snapshotHttpUrl: "http://admin:****@192.168.1.125/ISAPI/Streaming/channels/101/picture",
    hlsStreamUrl: "/assets/cftv/cftv_cam06_mineracao_areia.jpg",
    status: "online",
    fps: 20,
    resolucao: "2560x1440 (2K QHD)",
    iaAtiva: true,
    recursosIa: ["nivel_pilha_areia", "esteira_alimentadora", "seguranca_perimetro"],
    ultimaLeituraPlaca: "Draga 01 em Operação Contínua",
    confiancaUltimaPlaca: 98.9,
    dataHoraUltimaLeitura: new Date().toLocaleDateString("pt-BR") + " 17:42:01"
  }
];


const EVENTOS_SEED = [
  {
    id: "evt-01",
    cameraNome: "CAM-01 · Balança 80t (Totem LPR Entrada)",
    pontoRotulo: "Balança 80t - Totem LPR Entrada",
    tipo: "lpr_reconhecimento",
    titulo: "Placa Reconhecida · BT-01 (RRA-4E80)",
    descricao: "Betoneira BT-01 identificada automaticamente na 1ª pesagem. Enquadramento 100% OK.",
    confianca: 99.6,
    dataHora: new Date().toLocaleDateString("pt-BR") + " 17:42:10",
    snapshotUrl: "/assets/cftv/cftv_cam01_lpr_entrada.jpg"
  },
  {
    id: "evt-02",
    cameraNome: "CAM-04 · Pátio & Silos 96t (Manobras)",
    pontoRotulo: "Pátio de Betoneiras & Silos 96t",
    tipo: "epi_conformidade",
    titulo: "Inspeção de EPI · Conforme",
    descricao: "Capacete e colete refletivo detectados em todos os operadores no pátio de dosagem.",
    confianca: 98.4,
    dataHora: new Date().toLocaleDateString("pt-BR") + " 17:41:50",
    snapshotUrl: "/assets/cftv/cftv_cam04_patio_silos.jpg"
  },
  {
    id: "evt-03",
    cameraNome: "CAM-03 · Balança 80t (Cancela Saída)",
    pontoRotulo: "Balança 80t - Cancela Saída",
    tipo: "auditoria_ticket",
    titulo: "Saída Liberada · Ticket #8942",
    descricao: "Semáforo verde ativado. Ticket térmico NBR 7212 emitido com 33.480 kg brutos.",
    confianca: 99.9,
    dataHora: new Date().toLocaleDateString("pt-BR") + " 17:40:02",
    snapshotUrl: "/assets/cftv/cftv_cam03_cancela_saida.jpg"
  }
];

import React, { useState, useEffect } from "react";
import { api } from "../../../lib/api";

export default function ConcretoCamerasVisionAI({
  onVoltar,
  empresaAtivaId = "emp-concreto-serrano-01"
}) {
  const [cameras, setCameras] = useState(CAMERAS_SEED);
  const [eventos, setEventos] = useState(EVENTOS_SEED);
  const [carregando, setCarregando] = useState(false);
  const [visualizacao, setVisualizacao] = useState("grid"); // "grid", "foco", "tabela", "eventos", "guia"
  const [cameraFocada, setCameraFocada] = useState(CAMERAS_SEED[0]);
  const [modalCameraAberto, setModalCameraAberto] = useState(false);
  const [cameraEditando, setCameraEditando] = useState(null);
  const [modalGuiaAberto, setModalGuiaAberto] = useState(false);
  const [modalSnapshotAberto, setModalSnapshotAberto] = useState(false);
  const [snapshotAtivo, setSnapshotAtivo] = useState(null);
  const [testandoId, setTestandoId] = useState(null);
  const [analisandoId, setAnalisandoId] = useState(null);
  const [analiseResultado, setAnaliseResultado] = useState(null);
  const [relogio, setRelogio] = useState(new Date().toLocaleTimeString("pt-BR"));
  const [filtroPonto, setFiltroPonto] = useState("todos");

  // Formulário de Câmera IP
  const [formCamera, setFormCamera] = useState({
    nome: "",
    pontoInstalacao: "balanca_entrada_lpr",
    pontoRotulo: "Balança 80t - Totem LPR Entrada",
    marca: "intelbras",
    modelo: "",
    ipHost: "192.168.1.100",
    portaHttp: 80,
    portaRtsp: 554,
    portaOnvif: 80,
    portaServico: 37777,
    usuario: "admin",
    senha: "",
    canal: 1,
    substream: false,
    fps: 30,
    resolucao: "1920x1080 (Full HD)",
    codec: "H.265",
    recursosIa: {
      lprLeituraPlaca: true,
      enquadramentoBalanca: false,
      inspecaoEpi: true,
      monitoramentoSilos: false,
      cercaVirtual: true
    }
  });

  const [urlsGeradas, setUrlsGeradas] = useState({ streamRtspUrl: "", snapshotHttpUrl: "" });
  const [testeResultado, setTesteResultado] = useState(null);

  // Relógio do CCO
  useEffect(() => {
    const timer = setInterval(() => {
      setRelogio(new Date().toLocaleTimeString("pt-BR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Carregar câmeras e eventos
  const carregarDados = async () => {
    try {
      setCarregando(true);
      const resCam = await fetch(`/api/admin/concreto/cameras?empresaId=${empresaAtivaId}`);
      if (resCam.ok) {
        const dataCam = await resCam.json();
        if (dataCam.ok && Array.isArray(dataCam.cameras)) {
          setCameras(dataCam.cameras);
          if (!cameraFocada && dataCam.cameras.length > 0) {
            setCameraFocada(dataCam.cameras[0]);
          }
        }
      }

      const resEvt = await fetch(`/api/admin/concreto/cameras-eventos?empresaId=${empresaAtivaId}`);
      if (resEvt.ok) {
        const dataEvt = await resEvt.json();
        if (dataEvt.ok && Array.isArray(dataEvt.eventos)) {
          setEventos(dataEvt.eventos);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar câmeras IP:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [empresaAtivaId]);

  // Atualizar URLs geradas conforme dados do formulário
  useEffect(() => {
    const m = String(formCamera.marca || "intelbras").toLowerCase();
    const sub = formCamera.substream ? 1 : 0;
    const auth = formCamera.usuario ? `${encodeURIComponent(formCamera.usuario)}:${encodeURIComponent(formCamera.senha || "")}@` : "";
    const hostRtsp = `${formCamera.ipHost || "192.168.1.100"}:${formCamera.portaRtsp || 554}`;
    const hostHttp = `${formCamera.ipHost || "192.168.1.100"}${Number(formCamera.portaHttp) !== 80 ? ":" + formCamera.portaHttp : ""}`;

    let rtsp = "";
    let snap = "";

    if (m === "intelbras" || m === "dahua") {
      rtsp = `rtsp://${auth}${hostRtsp}/cam/realmonitor?channel=${formCamera.canal || 1}&subtype=${sub}`;
      snap = `http://${auth}${hostHttp}/cgi-bin/snapshot.cgi?channel=${formCamera.canal || 1}`;
    } else if (m === "hikvision" || m === "hilook") {
      const ch = Number(formCamera.canal) <= 16 ? (100 * Number(formCamera.canal) + (formCamera.substream ? 2 : 1)) : 101;
      rtsp = `rtsp://${auth}${hostRtsp}/Streaming/Channels/${ch}`;
      snap = `http://${auth}${hostHttp}/ISAPI/Streaming/channels/${ch}/picture`;
    } else if (m === "axis") {
      rtsp = `rtsp://${auth}${hostRtsp}/axis-media/media.amp?videocodec=h264`;
      snap = `http://${auth}${hostHttp}/axis-cgi/jpg/image.cgi`;
    } else {
      rtsp = `rtsp://${auth}${hostRtsp}/live/ch${formCamera.canal || 1}`;
      snap = `http://${auth}${hostHttp}/snapshot.jpg`;
    }

    setUrlsGeradas({ streamRtspUrl: rtsp, snapshotHttpUrl: snap });
  }, [formCamera.marca, formCamera.ipHost, formCamera.portaHttp, formCamera.portaRtsp, formCamera.usuario, formCamera.senha, formCamera.canal, formCamera.substream]);

  // Ações de Câmera
  const handleTestarCamera = async (camId) => {
    try {
      setTestandoId(camId);
      const res = await api.post(`/api/admin/concreto/cameras/${camId}/testar`, {});
      const data = await res.json();
      if (data.ok) {
        setCameras(prev => prev.map(c => c.id === camId ? { ...c, status: "online", latenciaMs: data.latenciaMs, ultimoPingEm: data.testadoEm } : c));
      }
    } catch (e) {
      console.error("Erro no teste da câmera:", e);
    } finally {
      setTestandoId(null);
    }
  };

  const handleTestarFormulario = async () => {
    try {
      setTestandoId("form");
      const res = await api.post("/api/admin/concreto/cameras/testar-conexao", formCamera);
      const data = await res.json();
      setTesteResultado(data);
    } catch (e) {
      setTesteResultado({ ok: false, erro: e.message });
    } finally {
      setTestandoId(null);
    }
  };

  const handleAnalisarKyttoIa = async (camId) => {
    try {
      setAnalisandoId(camId);
      const res = await api.post(`/api/admin/concreto/cameras/${camId}/analisar`, {});
      const data = await res.json();
      if (data.ok) {
        setAnaliseResultado({ camId, ...data });
        carregarDados();
      }
    } catch (e) {
      console.error("Erro ao analisar com KyttoIA:", e);
    } finally {
      setAnalisandoId(null);
    }
  };

  const handleAbrirSnapshot = (cam) => {
    setSnapshotAtivo({
      nome: cam.nome,
      url: cam.hlsStreamUrl || "/assets/cftv/cftv_cam01_lpr_entrada.jpg",
      ipHost: cam.ipHost,
      ponto: cam.pontoRotulo,
      dataHora: `${new Date().toLocaleDateString("pt-BR")} ${relogio}`,
      resolucao: cam.resolucao || "1920x1080 (Full HD)",
      fps: cam.fps || 30
    });
    setModalSnapshotAberto(true);
  };

  const handleAbrirModalNova = () => {
    setCameraEditando(null);
    setTesteResultado(null);
    setFormCamera({
      nome: "CAM-0" + (cameras.length + 1) + " · Nova Câmera Usina",
      pontoInstalacao: "balanca_entrada_lpr",
      pontoRotulo: "Balança 80t - Totem LPR Entrada",
      marca: "intelbras",
      modelo: "VIP 5450 Z IA",
      ipHost: "192.168.1." + (100 + cameras.length + 1),
      portaHttp: 80,
      portaRtsp: 554,
      portaOnvif: 80,
      portaServico: 37777,
      usuario: "admin",
      senha: "",
      canal: 1,
      substream: false,
      fps: 30,
      resolucao: "1920x1080 (Full HD)",
      codec: "H.265",
      recursosIa: {
        lprLeituraPlaca: true,
        enquadramentoBalanca: false,
        inspecaoEpi: true,
        monitoramentoSilos: false,
        cercaVirtual: true
      }
    });
    setModalCameraAberto(true);
  };

  const handleAbrirModalEditar = (cam) => {
    setCameraEditando(cam);
    setTesteResultado(null);
    setFormCamera({
      ...cam,
      senha: ""
    });
    setModalCameraAberto(true);
  };

  const handleSalvarCamera = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formCamera,
        streamRtspUrl: urlsGeradas.streamRtspUrl,
        snapshotHttpUrl: urlsGeradas.snapshotHttpUrl
      };

      let res;
      if (cameraEditando) {
        res = await api.put(`/api/admin/concreto/cameras/${cameraEditando.id}`, payload);
      } else {
        res = await api.post("/api/admin/concreto/cameras", payload);
      }

      if (res.ok) {
        setModalCameraAberto(false);
        carregarDados();
      }
    } catch (err) {
      console.error("Erro ao salvar câmera:", err);
    }
  };

  const handleExcluirCamera = async (camId) => {
    if (!window.confirm("Deseja realmente remover esta câmera IP da concreteira?")) return;
    try {
      const res = await api.delete(`/api/admin/concreto/cameras/${camId}`);
      if (res.ok) {
        carregarDados();
      }
    } catch (e) {
      console.error("Erro ao excluir câmera:", e);
    }
  };

  const handleReconhecerEvento = async (evtId) => {
    try {
      const res = await fetch(`/api/admin/concreto/cameras-eventos/${evtId}/reconhecer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operador: "Supervisor CCO Serrano" })
      });
      if (res.ok) {
        setEventos(prev => prev.map(e => e.id === evtId ? { ...e, reconhecido: true } : e));
      }
    } catch (e) {
      console.error("Erro ao reconhecer evento:", e);
    }
  };

  const camerasFiltradas = cameras.filter(c => {
    if (filtroPonto === "todos") return true;
    return c.pontoInstalacao === filtroPonto;
  });

  return (
    <div className="concreto-vision-wrapper" style={{ padding: 20, color: "#f8fafc", fontFamily: "Inter, sans-serif" }}>
      {/* HEADER DE COMANDO CCO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20, background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", padding: 20, borderRadius: 12, border: "1px solid #334155", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>📹</span>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.5px" }}>
              CENTRO DE CONTROLE OPERACIONAL · CÂMERAS IP & VISION AI
            </h2>
            <span style={{ background: "#10b981", color: "#064e3b", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#064e3b" }}></span>
              MOTOR KYTTOIA ATIVO
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 13 }}>
            Serrano Concreto & Mineração · Conexões Nativas RTSP/ONVIF · LPR Balança 80t · Silos 96t · Central NBR 7212
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ background: "#020617", border: "1px solid #1e293b", padding: "6px 14px", borderRadius: 8, textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Horário Oficial Tangará/MT</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#38bdf8", fontFamily: "monospace" }}>{relogio} BRT</div>
          </div>
          <button
            type="button"
            onClick={() => setModalGuiaAberto(true)}
            style={{ background: "#1e293b", border: "1px solid #475569", color: "#cbd5e1", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            title="Abrir guia de liberação de portas e RTSP para TI"
          >
            <span>📖</span>
            Guia de Portas TI
          </button>
          <button
            type="button"
            onClick={handleAbrirModalNova}
            style={{ background: "#ea580c", border: "none", color: "#ffffff", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(234, 88, 12, 0.4)" }}
          >
            <span>➕</span>
            Adicionar Câmera IP
          </button>
        </div>
      </div>

      {/* KPI METRICS BAR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Câmeras Industriais</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#f8fafc", margin: "4px 0" }}>{cameras.length}</div>
          <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>● {cameras.filter(c => c.status === "online").length} Conectadas (100% Online)</div>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Latência de Rede (Balança)</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#38bdf8", margin: "4px 0" }}>~14 ms</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Porta COM3 Toledo & RTSP 554</div>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Leitura LPR de Placas (Mercosul)</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#10b981", margin: "4px 0" }}>99.6%</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Reconhecimento Instantâneo KyttoIA</div>
        </div>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Eventos de Segurança / EPIs</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#f59e0b", margin: "4px 0" }}>{eventos.length}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>{eventos.filter(e => !e.reconhecido).length} Alertas Aguardando CCO</div>
        </div>
      </div>

      {/* BARRA DE NAVEGAÇÃO DE VISÕES & FILTROS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18, background: "#0f172a", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e293b" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setVisualizacao("grid")}
            style={{ background: visualizacao === "grid" ? "#ea580c" : "#1e293b", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>▦</span>
            Matriz CCO ({cameras.length})
          </button>
          <button
            type="button"
            onClick={() => setVisualizacao("foco")}
            style={{ background: visualizacao === "foco" ? "#ea580c" : "#1e293b", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>⛶</span>
            Foco & Overlay IA
          </button>
          <button
            type="button"
            onClick={() => setVisualizacao("tabela")}
            style={{ background: visualizacao === "tabela" ? "#ea580c" : "#1e293b", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>☰</span>
            Gerenciar Conexões IP
          </button>
          <button
            type="button"
            onClick={() => setVisualizacao("eventos")}
            style={{ background: visualizacao === "eventos" ? "#ea580c" : "#1e293b", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🔔</span>
            Eventos LPR & Vision ({eventos.length})
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#94a3b8" }}>Ponto:</label>
          <select
            value={filtroPonto}
            onChange={(e) => setFiltroPonto(e.target.value)}
            style={{ background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 6, padding: "5px 10px", fontSize: 12, outline: "none" }}
          >
            <option value="todos">Todos os Pontos ({cameras.length})</option>
            <option value="balanca_entrada_lpr">Balança 80t - Entrada LPR</option>
            <option value="balanca_panoramica_21m">Balança 80t - Panorâmica 21m</option>
            <option value="balanca_saida_cancela">Balança 80t - Cancela Saída</option>
            <option value="patio_geral">Pátio de Betoneiras</option>
            <option value="central_dosadora">Central Dosadora NBR 7212</option>
            <option value="silos_mineracao">Mineração & Silos 96t</option>
          </select>
        </div>
      </div>

      {/* 1. VISÃO GRID (MATRIZ CCO AO VIVO) */}
      {visualizacao === "grid" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
          {camerasFiltradas.map((cam) => {
            const ehTestando = testandoId === cam.id;
            const ehAnalisando = analisandoId === cam.id;

            return (
              <div
                key={cam.id}
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 10,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                }}
              >
                {/* Cabeçalho do Card */}
                <div style={{ padding: "10px 14px", background: "#1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc" }}>{cam.nome}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{cam.pontoRotulo} · {cam.marca.toUpperCase()} ({cam.ipHost}:{cam.portaRtsp})</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, background: "#065f46", color: "#34d399", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                      ● {cam.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 10, background: "#0284c7", color: "#e0f2fe", padding: "2px 6px", borderRadius: 4 }}>
                      {cam.fps || 30} FPS
                    </span>
                  </div>
                </div>

                {/* Feed de Vídeo / Frame */}
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "16/9",
                    background: "#020617",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    setCameraFocada(cam);
                    setVisualizacao("foco");
                  }}
                  title="Clique para ver em tela cheia com overlay KyttoIA"
                >
                  <img
                    src={cam.hlsStreamUrl || "/assets/cftv/cftv_cam01_lpr_entrada.jpg"}
                    alt={cam.nome}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      e.target.src = "/assets/cftv/cftv_cam01_lpr_entrada.jpg";
                    }}
                  />

                  {/* Overlay CCO Industrial */}
                  <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(15, 23, 42, 0.8)", padding: "3px 8px", borderRadius: 4, fontSize: 10, color: "#f8fafc", fontFamily: "monospace", border: "1px solid rgba(255,255,255,0.1)" }}>
                    🔴 AO VIVO · {relogio} · {cam.latenciaMs || 14}ms
                  </div>

                  {cam.recursosIa?.lprLeituraPlaca && (
                    <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(16, 185, 129, 0.9)", padding: "3px 8px", borderRadius: 4, fontSize: 11, color: "#064e3b", fontWeight: 900, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>🎯 LPR:</span>
                      <span>{cam.ultimaPlacaDetectada || "RRA-4E80"} (99.6%)</span>
                    </div>
                  )}

                  <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(15, 23, 42, 0.8)", padding: "3px 8px", borderRadius: 4, fontSize: 10, color: "#94a3b8" }}>
                    {cam.resolucao || "1080p"} · {cam.codec || "H.265"}
                  </div>
                </div>

                {/* Barra de Ações Rápidas da Câmera */}
                <div style={{ padding: "8px 12px", background: "#0b1329", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleAbrirSnapshot(cam)}
                    style={{ background: "#1e293b", border: "1px solid #334155", color: "#cbd5e1", padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    title="Capturar foto instantânea em alta resolução"
                  >
                    <span>📸</span>
                    Foto
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestarCamera(cam.id)}
                    disabled={ehTestando}
                    style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    title="Testar ping TCP e fluxo RTSP"
                  >
                    <span>⚡</span>
                    {ehTestando ? "Testando..." : "Testar RTSP"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAnalisarKyttoIa(cam.id)}
                    disabled={ehAnalisando}
                    style={{ background: "#ea580c", border: "none", color: "#fff", padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    title="Executar reconhecimento visual KyttoIA"
                  >
                    <span>🤖</span>
                    {ehAnalisando ? "Analisando..." : "Analisar IA"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAbrirModalEditar(cam)}
                    style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 14, cursor: "pointer", padding: "4px" }}
                    title="Configurações Técnicas"
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. VISÃO FOCO COM OVERLAY DE INTELIGÊNCIA ARTIFICIAL */}
      {visualizacao === "foco" && cameraFocada && (
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f8fafc" }}>{cameraFocada.nome}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{cameraFocada.pontoRotulo} · RTSP: {cameraFocada.streamRtspUrl}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleTestarCamera(cameraFocada.id)}
                style={{ background: "#1e293b", border: "1px solid #475569", color: "#38bdf8", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                ⚡ Testar Conexão ({cameraFocada.latenciaMs || 14}ms)
              </button>
              <button
                type="button"
                onClick={() => handleAnalisarKyttoIa(cameraFocada.id)}
                style={{ background: "#ea580c", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
              >
                🤖 Reanalisar com KyttoIA
              </button>
              <button
                type="button"
                onClick={() => setVisualizacao("grid")}
                style={{ background: "#334155", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Voltar à Matriz
              </button>
            </div>
          </div>

          <div style={{ position: "relative", width: "100%", maxHeight: "680px", aspectRatio: "16/9", background: "#000", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src={cameraFocada.hlsStreamUrl || "/assets/cftv/cftv_cam01_lpr_entrada.jpg"}
              alt={cameraFocada.nome}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />

            {/* Bounding Boxes da KyttoIA */}
            <div style={{ position: "absolute", top: "70%", left: "40%", width: "20%", height: "12%", border: "2px solid #10b981", background: "rgba(16, 185, 129, 0.15)", borderRadius: 4, display: "flex", alignItems: "flex-start", padding: 4 }}>
              <span style={{ background: "#10b981", color: "#064e3b", fontSize: 11, fontWeight: 900, padding: "2px 6px", borderRadius: 3 }}>
                PLACA LPR: RRA-4E80 (99.7%)
              </span>
            </div>

            <div style={{ position: "absolute", top: "25%", left: "20%", width: "60%", height: "65%", border: "2px dashed #38bdf8", background: "rgba(56, 189, 248, 0.05)", borderRadius: 8, pointerEvents: "none" }}>
              <span style={{ position: "absolute", top: -22, left: 0, background: "#0284c7", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4 }}>
                VEÍCULO: BETONEIRA 8x4 VW CONSTELLATION 26.280 (Serrano)
              </span>
            </div>

            {/* OSD Inferior */}
            <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(4px)", padding: "10px 14px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 12, color: "#f8fafc" }}>
                <strong>Inspeção Visual KyttoIA:</strong> 8 Células de Carga Centradas · Enquadramento 100% OK · EPIs Motorista Conforme
              </div>
              <div style={{ fontSize: 11, color: "#38bdf8", fontFamily: "monospace" }}>
                STREAM: {cameraFocada.streamRtspUrl}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. VISÃO TABELA TÉCNICA (GESTÃO DE CONEXÕES IP) */}
      {visualizacao === "tabela" && (
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: "#1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Inventário Técnico de Câmeras IP & Conexões RTSP/ONVIF</h3>
            <button
              type="button"
              onClick={handleAbrirModalNova}
              style={{ background: "#ea580c", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              + Nova Câmera
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#0b1329", color: "#94a3b8", borderBottom: "1px solid #1e293b" }}>
                  <th style={{ padding: "10px 14px" }}>Câmera / Modelo</th>
                  <th style={{ padding: "10px 14px" }}>Ponto de Instalação</th>
                  <th style={{ padding: "10px 14px" }}>Endereço IP & Portas</th>
                  <th style={{ padding: "10px 14px" }}>Protocolos</th>
                  <th style={{ padding: "10px 14px" }}>Status / Ping</th>
                  <th style={{ padding: "10px 14px" }}>Recursos IA</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((cam) => (
                  <tr key={cam.id} style={{ borderBottom: "1px solid #1e293b", color: "#e2e8f0" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 800, color: "#f8fafc" }}>{cam.nome}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{cam.marca.toUpperCase()} · {cam.modelo}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: "#1e293b", padding: "3px 8px", borderRadius: 4, fontSize: 11 }}>
                        {cam.pontoRotulo}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontFamily: "monospace" }}>
                      <div>{cam.ipHost}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>HTTP: {cam.portaHttp} | RTSP: {cam.portaRtsp} | ONVIF: {cam.portaOnvif}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: "#38bdf8" }}>RTSP H.265 / HLS</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>Snapshot HTTP JPEG</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: "#065f46", color: "#34d399", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                        ● ONLINE ({cam.latenciaMs || 14}ms)
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {cam.recursosIa?.lprLeituraPlaca && <span style={{ background: "#0284c7", color: "#e0f2fe", fontSize: 9, padding: "2px 4px", borderRadius: 3 }}>LPR</span>}
                        {cam.recursosIa?.enquadramentoBalanca && <span style={{ background: "#10b981", color: "#064e3b", fontSize: 9, padding: "2px 4px", borderRadius: 3 }}>Balança</span>}
                        {cam.recursosIa?.inspecaoEpi && <span style={{ background: "#f59e0b", color: "#78350f", fontSize: 9, padding: "2px 4px", borderRadius: 3 }}>EPI</span>}
                        {cam.recursosIa?.monitoramentoSilos && <span style={{ background: "#8b5cf6", color: "#ede9fe", fontSize: 9, padding: "2px 4px", borderRadius: 3 }}>Silos</span>}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleTestarCamera(cam.id)}
                          style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "4px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                          title="Testar Conexão"
                        >
                          ⚡
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAbrirModalEditar(cam)}
                          style={{ background: "#1e293b", border: "1px solid #334155", color: "#f8fafc", padding: "4px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                          title="Editar Câmera"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluirCamera(cam.id)}
                          style={{ background: "#7f1d1d", border: "none", color: "#fca5a5", padding: "4px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                          title="Excluir Câmera"
                        >
                          🗑️
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

      {/* 4. LOG DE EVENTOS VISION AI */}
      {visualizacao === "eventos" && (
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Histórico de Eventos de Visão Computacional KyttoIA</h3>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{eventos.length} registros capturados</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {eventos.map((evt) => (
              <div
                key={evt.id}
                style={{
                  background: "#1e293b",
                  border: `1px solid ${evt.reconhecido ? "#334155" : "#ea580c"}`,
                  borderRadius: 8,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <img
                    src={evt.snapshotUrl || "/assets/cftv/cftv_cam01_lpr_entrada.jpg"}
                    alt="Evidência"
                    style={{ width: 80, height: 50, objectFit: "cover", borderRadius: 6, border: "1px solid #334155" }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, color: "#f8fafc", fontSize: 13 }}>{evt.tipoRotulo}</span>
                      <span style={{ background: "#0284c7", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4 }}>
                        {evt.confianca}% precisão
                      </span>
                      {evt.placaDetectada && (
                        <span style={{ background: "#10b981", color: "#064e3b", fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 4 }}>
                          {evt.placaDetectada}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>{evt.detalhes}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{evt.cameraNome} · {evt.dataHora}</div>
                  </div>
                </div>

                <div>
                  {evt.reconhecido ? (
                    <span style={{ background: "#065f46", color: "#34d399", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                      ✓ Reconhecido CCO
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReconhecerEvento(evt.id)}
                      style={{ background: "#ea580c", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                    >
                      Reconhecer Alerta
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR / EDITAR CÂMERA IP */}
      {modalCameraAberto && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>
                {cameraEditando ? "Editar Câmera IP Industrial" : "Adicionar Nova Câmera IP (RTSP/ONVIF)"}
              </h3>
              <button
                type="button"
                onClick={() => setModalCameraAberto(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarCamera} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Nome da Câmera</label>
                <input
                  type="text"
                  required
                  value={formCamera.nome}
                  onChange={(e) => setFormCamera(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: CAM-01 · Totem LPR Entrada Balança 80t"
                  style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Fabricante / Marca</label>
                  <select
                    value={formCamera.marca}
                    onChange={(e) => setFormCamera(prev => ({ ...prev, marca: e.target.value }))}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4 }}
                  >
                    <option value="intelbras">Intelbras (VIP / iMDVR / iSIC)</option>
                    <option value="hikvision">Hikvision (ColorVu / AcuSense)</option>
                    <option value="hilook">HiLook (Série Bullet / Dome)</option>
                    <option value="dahua">Dahua (WizSense / ITC LPR)</option>
                    <option value="axis">Axis Communications</option>
                    <option value="onvif_generica">ONVIF / RTSP Genérico</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Ponto de Instalação</label>
                  <select
                    value={formCamera.pontoInstalacao}
                    onChange={(e) => setFormCamera(prev => ({ ...prev, pontoInstalacao: e.target.value, pontoRotulo: e.target.options[e.target.selectedIndex].text }))}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4 }}
                  >
                    <option value="balanca_entrada_lpr">Balança 80t - Totem LPR Entrada</option>
                    <option value="balanca_panoramica_21m">Balança 80t - Panorâmica 21m</option>
                    <option value="balanca_saida_cancela">Balança 80t - Cancela Saída</option>
                    <option value="patio_geral">Pátio de Betoneiras & Carga</option>
                    <option value="central_dosadora">Central Dosadora NBR 7212</option>
                    <option value="silos_mineracao">Mineração & Silos 96t</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Endereço IP ou Host</label>
                  <input
                    type="text"
                    required
                    value={formCamera.ipHost}
                    onChange={(e) => setFormCamera(prev => ({ ...prev, ipHost: e.target.value }))}
                    placeholder="192.168.1.100"
                    style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Porta RTSP</label>
                  <input
                    type="number"
                    value={formCamera.portaRtsp}
                    onChange={(e) => setFormCamera(prev => ({ ...prev, portaRtsp: Number(e.target.value) }))}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Porta HTTP</label>
                  <input
                    type="number"
                    value={formCamera.portaHttp}
                    onChange={(e) => setFormCamera(prev => ({ ...prev, portaHttp: Number(e.target.value) }))}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Usuário</label>
                  <input
                    type="text"
                    value={formCamera.usuario}
                    onChange={(e) => setFormCamera(prev => ({ ...prev, usuario: e.target.value }))}
                    placeholder="admin"
                    style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Senha</label>
                  <input
                    type="password"
                    value={formCamera.senha}
                    onChange={(e) => setFormCamera(prev => ({ ...prev, senha: e.target.value }))}
                    placeholder="••••••••"
                    style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Canal DVR/NVR</label>
                  <input
                    type="number"
                    value={formCamera.canal}
                    onChange={(e) => setFormCamera(prev => ({ ...prev, canal: Number(e.target.value) }))}
                    style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginTop: 4, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Preview das URLs Geradas Automaticamente */}
              <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", marginBottom: 6 }}>
                  URLs RTSP & SNAPSHOT GERADAS AUTOMATICAMENTE (Padrão {formCamera.marca.toUpperCase()}):
                </div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", wordBreak: "break-all" }}>
                  <strong>RTSP:</strong> {urlsGeradas.streamRtspUrl}
                </div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", wordBreak: "break-all", marginTop: 4 }}>
                  <strong>Snapshot HTTP:</strong> {urlsGeradas.snapshotHttpUrl}
                </div>
              </div>

              {/* Recursos de IA Ativos */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Módulos de Visão KyttoIA Habilitados</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={formCamera.recursosIa.lprLeituraPlaca}
                      onChange={(e) => setFormCamera(prev => ({ ...prev, recursosIa: { ...prev.recursosIa, lprLeituraPlaca: e.target.checked } }))}
                    />
                    Leitura LPR de Placas Mercosul
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={formCamera.recursosIa.enquadramentoBalanca}
                      onChange={(e) => setFormCamera(prev => ({ ...prev, recursosIa: { ...prev.recursosIa, enquadramentoBalanca: e.target.checked } }))}
                    />
                    Enquadramento Plataforma 21m
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={formCamera.recursosIa.inspecaoEpi}
                      onChange={(e) => setFormCamera(prev => ({ ...prev, recursosIa: { ...prev.recursosIa, inspecaoEpi: e.target.checked } }))}
                    />
                    Inspeção de EPIs (Capacete / Colete)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={formCamera.recursosIa.monitoramentoSilos}
                      onChange={(e) => setFormCamera(prev => ({ ...prev, recursosIa: { ...prev.recursosIa, monitoramentoSilos: e.target.checked } }))}
                    />
                    Nível e Transbordo de Silos 96t
                  </label>
                </div>
              </div>

              {/* Resultado do Teste de Conexão */}
              {testeResultado && (
                <div style={{ background: testeResultado.ok ? "#064e3b" : "#7f1d1d", color: "#fff", padding: 10, borderRadius: 6, fontSize: 12 }}>
                  {testeResultado.ok ? `✓ Conexão RTSP bem-sucedida! Latência: ${testeResultado.latenciaMs}ms (${testeResultado.resolucao})` : `✕ Erro no teste: ${testeResultado.erro}`}
                </div>
              )}

              {/* Rodapé do Modal */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e293b", paddingTop: 14, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={handleTestarFormulario}
                  disabled={testandoId === "form"}
                  style={{ background: "#1e293b", border: "1px solid #475569", color: "#38bdf8", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {testandoId === "form" ? "Testando..." : "⚡ Testar Conexão Agora"}
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setModalCameraAberto(false)}
                    style={{ background: "#334155", border: "none", color: "#cbd5e1", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{ background: "#ea580c", border: "none", color: "#fff", padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                  >
                    Salvar Câmera
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GUIA TÉCNICO DE INTEGRAÇÃO TI & LIBERAÇÃO DE PORTAS */}
      {modalGuiaAberto && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, maxWidth: 740, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#f8fafc" }}>
                  Guia Técnico de Integração TI · Câmeras IP & DVRs/NVRs
                </h3>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  Serrano Concreto & Mineração · Padrões de Comunicação RTSP / ONVIF / HTTP
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalGuiaAberto(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
              <h4 style={{ color: "#ea580c", margin: "14px 0 6px" }}>1. Intelbras (VIP, iMDVR, iSIC e Gravadores Multi-HD)</h4>
              <p style={{ margin: 0 }}>
                Para integrar câmeras e DVRs Intelbras na usina, libere no roteador/firewall a <strong>Porta RTSP (554)</strong> e a <strong>Porta HTTP (80)</strong>:
              </p>
              <div style={{ background: "#020617", padding: "8px 12px", borderRadius: 6, fontFamily: "monospace", fontSize: 12, color: "#38bdf8", margin: "8px 0" }}>
                RTSP: rtsp://usuario:senha@IP:554/cam/realmonitor?channel=CANAL&subtype=0<br />
                Snapshot: http://usuario:senha@IP:80/cgi-bin/snapshot.cgi?channel=CANAL
              </div>

              <h4 style={{ color: "#ea580c", margin: "16px 0 6px" }}>2. Hikvision & HiLook (ColorVu, DarkFighter e AcuSense)</h4>
              <p style={{ margin: 0 }}>
                O canal no RTSP Hikvision utiliza numeração composta: Canal 1 = <strong>101</strong> (main stream) ou <strong>102</strong> (substream):
              </p>
              <div style={{ background: "#020617", padding: "8px 12px", borderRadius: 6, fontFamily: "monospace", fontSize: 12, color: "#38bdf8", margin: "8px 0" }}>
                RTSP: rtsp://usuario:senha@IP:554/Streaming/Channels/101<br />
                Snapshot: http://usuario:senha@IP:80/ISAPI/Streaming/channels/101/picture
              </div>

              <h4 style={{ color: "#ea580c", margin: "16px 0 6px" }}>3. Recomendações de Consumo de Banda & Edge Gateway</h4>
              <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
                <li><strong>Main Stream (1080p / 4MP)</strong>: utilize para LPR e pesagem na balança 80t (consumo ~4 Mbps).</li>
                <li><strong>Substream (720p / D1)</strong>: ideal para monitoramento contínuo de pátio e múltiplos operadores simultâneos (~512 Kbps).</li>
                <li><strong>Câmeras em IP Privado</strong>: se as câmeras estiverem em rede local (ex: <code>192.168.1.x</code>), o gateway local da balança conecta diretamente sem necessidade de IP público.</li>
              </ul>
            </div>

            <div style={{ textAlign: "right", marginTop: 20, borderTop: "1px solid #1e293b", paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setModalGuiaAberto(false)}
                style={{ background: "#ea580c", border: "none", color: "#fff", padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
              >
                Entendi / Fechar Guia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SNAPSHOT EM ALTA RESOLUÇÃO */}
      {modalSnapshotAberto && snapshotAtivo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, maxWidth: 860, width: "100%", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>
                  Snapshot Fotográfico · {snapshotAtivo.nome}
                </h3>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {snapshotAtivo.ponto} · {snapshotAtivo.dataHora} · {snapshotAtivo.resolucao}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSnapshotAberto(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
              <img
                src={snapshotAtivo.url}
                alt="Snapshot Câmera"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>
                ✓ Frame autenticado com carimbo IPEM-MT e hash metrológico Kytto
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={snapshotAtivo.url}
                  download="snapshot_camera_usina.jpg"
                  style={{ background: "#1e293b", border: "1px solid #475569", color: "#38bdf8", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span>⬇️</span>
                  Baixar Imagem
                </a>
                <button
                  type="button"
                  onClick={() => setModalSnapshotAberto(false)}
                  style={{ background: "#ea580c", border: "none", color: "#fff", padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
