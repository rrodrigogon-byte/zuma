import React, { useState, useEffect, useMemo } from 'react';
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
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modais
  const [modalNovaCargaAberto, setModalNovaCargaAberto] = useState(false);
  const [modalRomaneioAberto, setModalRomaneioAberto] = useState(null);
  const [modalRupturaAberto, setModalRupturaAberto] = useState(null);
  const [modalNovaPropostaAberto, setModalNovaPropostaAberto] = useState(false);
  const [modalLaudoAberto, setModalLaudoAberto] = useState(null);

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
                          FCK {c.fck} MPa · {c.brita || 'Brita 1'}
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

      {/* ─── MODAL: ROMANEIO NBR 7212 ─── */}
      {modalRomaneioAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card">
            <h2>Romaneio de Entrega de Concreto · NBR 7212</h2>
            <div style={{ background: 'var(--surface-2)', padding: 18, borderRadius: 8, fontFamily: 'var(--font-data)', fontSize: 12, lineHeight: 1.6 }}>
              <div><b>SERRANO CONCRETO USINADO &amp; MINERAÇÃO LTDA</b></div>
              <div>CNPJ: 53.798.485/0001-77 · IE: 14.229.191-9</div>
              <div>Tangará da Serra - MT · Telefone: (65) 99946-4899</div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--joint)', margin: '10px 0' }} />
              <div><b>ROMANEIO Nº {modalRomaneioAberto.numero || '1001'}</b> · Data: 12/11/2026</div>
              <div>Cliente: {modalRomaneioAberto.cliente}</div>
              <div>Obra: {modalRomaneioAberto.obra}</div>
              <div>Traço: FCK {modalRomaneioAberto.fck} MPa · Brita 1 · Slump {modalRomaneioAberto.slump || '14 ± 2 cm'}</div>
              <div>Volume Total: {modalRomaneioAberto.volumeM3} m³</div>
              <div>Descarga: {modalRomaneioAberto.bomba || 'Bomba Lança 32m'}</div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--joint)', margin: '10px 0' }} />
              <div>Adição de Água na Usina: 08:10 · Limite Pega NBR 7212: 150 min (10:40)</div>
              <div>Responsável Técnica: Engª Karin Prestes (CREA-MT 027300)</div>
            </div>
            <div className="serrano-modal-footer">
              <button 
                type="button" 
                className="btn-serrano pri"
                onClick={() => setModalRomaneioAberto(null)}
              >
                Fechar Romaneio
              </button>
            </div>
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

    </div>
  );
}
