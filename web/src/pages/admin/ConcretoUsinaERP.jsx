import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';

const DADOS_CARGAS_FALLBACK = [
  {
    id: "crg-1001", numero: 1001, cliente: "Construtora MT Horizon",
    obra: "Edifício Residencial Serra Dourada · Lajes do 4º Pavimento",
    endereco: "Rua José Corsino, 450, Jardim Europa, Tangará da Serra/MT",
    fck: "FCK 30 MPa (Brita 1)", slump: "14 ± 2 cm", volumeM3: 24, bomba: "BL-01 (Bomba Lança 32m)",
    horarioAgendado: "08:30", status: "concluido",
    viagens: [
      { betoneira: "BT-01", motorista: "Marcos Silveira", volume: 8, saida: "08:15", chegada: "08:35", fimDescarga: "09:20" },
      { betoneira: "BT-02", motorista: "Carlos Eduardo Santos", volume: 8, saida: "08:50", chegada: "09:10", fimDescarga: "10:00" },
      { betoneira: "BT-03", motorista: "Valdemir Oliveira", volume: 8, saida: "09:30", chegada: "09:55", fimDescarga: "10:45" },
    ],
    valorTotal: 11160.00, laudoCp: "CP-2026-089 (4 corpos de prova moldados)"
  },
  {
    id: "crg-1002", numero: 1002, cliente: "AgroLog Transportes & Logística",
    obra: "Piso Industrial Galpão de Cargas · Etapa 2",
    endereco: "Av. Lions Internacional, 1800, Distrito Industrial, Tangará da Serra/MT",
    fck: "FCK 35 MPa com Fibras Sintéticas", slump: "14 ± 2 cm", volumeM3: 32, bomba: "Descarga Direta (Calha)",
    horarioAgendado: "13:30", status: "em_transito",
    viagens: [
      { betoneira: "BT-01", motorista: "Marcos Silveira", volume: 8, saida: "13:10", chegada: "13:25", fimDescarga: "14:15" },
      { betoneira: "BT-02", motorista: "Carlos Eduardo Santos", volume: 8, saida: "13:45", chegada: "14:05", fimDescarga: null },
      { betoneira: "BT-04", motorista: "Roberto Lima", volume: 8, saida: "14:20", chegada: null, fimDescarga: null },
      { betoneira: "BT-05", motorista: "Fernando Souza", volume: 8, saida: null, chegada: null, fimDescarga: null },
    ],
    valorTotal: 15360.00, laudoCp: "CP-2026-090 (4 corpos de prova moldados)"
  },
  {
    id: "crg-1003", numero: 1003, cliente: "Eng. Marcelo Dantas Residencial",
    obra: "Casa Térrea Lote 12 Quadra 08 · Vigas e Baldrames",
    endereco: "Rua das Palmeiras, 112, Alphaville Tangará, Tangará da Serra/MT",
    fck: "FCK 25 MPa (Brita 1)", slump: "12 ± 2 cm", volumeM3: 16, bomba: "BL-01 (Bomba Lança 32m)",
    horarioAgendado: "16:00", status: "carregando",
    viagens: [
      { betoneira: "BT-03", motorista: "Valdemir Oliveira", volume: 8, saida: null, chegada: null, fimDescarga: null },
      { betoneira: "BT-04", motorista: "Roberto Lima", volume: 8, saida: null, chegada: null, fimDescarga: null },
    ],
    valorTotal: 7310.00, laudoCp: "Pendente de moldagem"
  }
];

const DADOS_CATALOGO_FALLBACK = [
  { id: "cnc-fck-20", nome: "Concreto Usinado FCK 20 MPa (Pisos e Baldrames)", categoria: "Concreto Usinado", preco: 380.00, unidade: "m³", fck: 20, slump: "12 ± 2 cm", brita: "Brita 1", traco: "1 : 2,2 : 2,8 : 0,55", descricao: "Indicado para pisos residenciais, calçadas, baldrames e estacas de fundação." },
  { id: "cnc-fck-25", nome: "Concreto Usinado FCK 25 MPa (Lajes, Vigas e Pilares)", categoria: "Concreto Usinado", preco: 410.00, unidade: "m³", fck: 25, slump: "12 ± 2 cm", brita: "Brita 1", traco: "1 : 1,9 : 2,5 : 0,50", descricao: "O traço mais consumido na construção civil para lajes maciças, treliçadas, vigas e pilares residenciais." },
  { id: "cnc-fck-30", nome: "Concreto Usinado FCK 30 MPa (Estrutural Pesado / Edifícios)", categoria: "Concreto Usinado", preco: 440.00, unidade: "m³", fck: 30, slump: "14 ± 2 cm", brita: "Brita 1", traco: "1 : 1,6 : 2,2 : 0,45", descricao: "Concreto de alta resistência para edifícios comerciais, galpões de grande vão e fundações de alto porte." },
  { id: "cnc-fck-35", nome: "Concreto Usinado FCK 35 MPa (Pisos Industriais)", categoria: "Concreto Usinado", preco: 480.00, unidade: "m³", fck: 35, slump: "14 ± 2 cm", brita: "Brita 1", traco: "1 : 1,4 : 1,9 : 0,42", descricao: "Elevada durabilidade e resistência à abrasão para tráfego pesado de carretas e empilhadeiras." },
  { id: "cnc-fck-40", nome: "Concreto Usinado FCK 40 MPa (Obras Especiais e Pontes)", categoria: "Concreto Usinado", preco: 520.00, unidade: "m³", fck: 40, slump: "16 ± 2 cm", brita: "Brita 1", traco: "1 : 1,2 : 1,7 : 0,38", descricao: "Concreto de alta performance para pontes, viadutos e estruturas pré-tensionadas." },
  { id: "cnc-fck-15", nome: "Concreto Magro / Regularização FCK 15 MPa", categoria: "Concreto Usinado", preco: 340.00, unidade: "m³", fck: 15, slump: "10 ± 2 cm", brita: "Brita 2", traco: "1 : 3,0 : 3,5 : 0,65", descricao: "Camada de proteção e nivelamento para fundações e armaduras." },
  { id: "cnc-bomb-brita0-25", nome: "Concreto Bombeável Brita 0 (Pedrisco) FCK 25 MPa", categoria: "Concretos Especiais", preco: 425.00, unidade: "m³", fck: 25, slump: "16 ± 2 cm", brita: "Brita 0", traco: "1 : 2,1 : 2,2 : 0,50", descricao: "Ideal para lajes nervuradas, ferragens densas e tubulações longas de bombeamento." },
  { id: "cnc-bomb-brita0-30", nome: "Concreto Bombeável Brita 0 (Pedrisco) FCK 30 MPa", categoria: "Concretos Especiais", preco: 455.00, unidade: "m³", fck: 30, slump: "16 ± 2 cm", brita: "Brita 0", traco: "1 : 1,8 : 2,0 : 0,45", descricao: "Concreto de alta fluidez para pilares esbeltos e vigas com alta taxa de aço." },
  { id: "cnc-auto-adensavel", nome: "Concreto Auto-adensável (CAA) FCK 30 MPa", categoria: "Concretos Especiais", preco: 475.00, unidade: "m³", fck: 30, slump: "Espalhamento 65cm", brita: "Brita 0/1", traco: "1 : 1,7 : 2,0 : 0,44", descricao: "Concreto fluido que preenche todas as formas sem necessidade de vibração mecânica." },
  { id: "cnc-fibras-sinteticas", nome: "Concreto com Fibras Estruturais FCK 30 MPa", categoria: "Concretos Especiais", preco: 465.00, unidade: "m³", fck: 30, slump: "14 ± 2 cm", brita: "Brita 1", traco: "1 : 1,6 : 2,2 : 0,45 + 1kg Fibra", descricao: "Adição de fibras de polipropileno para controle de fissuras por retração plástica." },
  { id: "srv-bomba-lanca-32", nome: "Serviço de Caminhão Bomba Lança 32m (até 25 m³)", categoria: "Serviços de Bombeamento", preco: 750.00, unidade: "viagem", descricao: "Taxa mínima de bombeamento com alcance vertical de 32 metros e tubulação flexível." },
  { id: "srv-bomba-excedente", nome: "Bombeamento Adicional por m³ excedente", categoria: "Serviços de Bombeamento", preco: 25.00, unidade: "m³", descricao: "Valor cobrado por metro cúbico bombeado acima da taxa mínima de 25m³." },
  { id: "ins-cimento-cp2", nome: "Cimento Portland CP II-F-32 a Granel", categoria: "Insumos de Usina", preco: 680.00, unidade: "ton", estoqueAtual: 120, estoqueMinimo: 25, descricao: "Armazenado em silos verticais de 60t com pesagem por células de carga." },
  { id: "ins-areia-media", nome: "Areia Média Lavada de Rio Natural", categoria: "Insumos de Usina", preco: 95.00, unidade: "m³", estoqueAtual: 450, estoqueMinimo: 80, descricao: "Baixo teor de finos, curva granulométrica controlada para traços nobres." },
  { id: "ins-brita-1", nome: "Brita 1 Granítica Selecionada (9,5 a 19 mm)", categoria: "Insumos de Usina", preco: 110.00, unidade: "m³", estoqueAtual: 580, estoqueMinimo: 100, descricao: "Agregado graúdo de alta dureza para estrutura e pisos." },
  { id: "ins-brita-0", nome: "Brita 0 / Pedrisco Basáltico (4,8 a 9,5 mm)", categoria: "Insumos de Usina", preco: 115.00, unidade: "m³", estoqueAtual: 320, estoqueMinimo: 60, descricao: "Agregado miúdo limpo para concretos bombeáveis de brita zero." },
];

const DADOS_FROTA_FALLBACK = [
  { id: "bet-01", codigo: "BT-01", placa: "RAX-3E21", modelo: "Mercedes-Benz Actros 2651 8x4", capacidadeM3: 10, tipo: "betoneira", status: "em_transito", motorista: "Marcos Silveira", telefone: "(65) 99981-1101", horimetro: 3420 },
  { id: "bet-02", codigo: "BT-02", placa: "RBY-4F32", modelo: "Scania P360 8x4", capacidadeM3: 10, tipo: "betoneira", status: "em_transito", motorista: "Carlos Eduardo Santos", telefone: "(65) 99981-1102", horimetro: 2890 },
  { id: "bet-03", codigo: "BT-03", placa: "RCZ-5G43", modelo: "Volvo VM 330 6x4", capacidadeM3: 8, tipo: "betoneira", status: "disponivel", motorista: "Valdemir Oliveira", telefone: "(65) 99981-1103", horimetro: 4150 },
  { id: "bet-04", codigo: "BT-04", placa: "RDA-6H54", modelo: "Ford Cargo 2629 6x4", capacidadeM3: 8, tipo: "betoneira", status: "carregando", motorista: "Roberto Lima", telefone: "(65) 99981-1104", horimetro: 5120 },
  { id: "bet-05", codigo: "BT-05", placa: "RDB-7J65", modelo: "VW Constellation 26.280 6x4", capacidadeM3: 8, tipo: "betoneira", status: "disponivel", motorista: "Fernando Souza", telefone: "(65) 99981-1105", horimetro: 1980 },
  { id: "bmb-01", codigo: "BL-01", placa: "REC-8K76", modelo: "Mercedes-Benz Atego 2430 6x2", alcanceMetros: 32, tipo: "bomba_lanca", status: "na_obra", operador: "Gilberto Ramos", telefone: "(65) 99981-2201", horimetro: 1640 },
  { id: "bmb-02", codigo: "BL-02", placa: "RED-9L87", modelo: "Volvo VM 270 6x2 Schwing", alcanceMetros: 36, tipo: "bomba_lanca", status: "disponivel", operador: "Claudemir Costa", telefone: "(65) 99981-2202", horimetro: 2110 },
];



const STATUS_CORES = {
  agendado: { bg: 'rgba(100, 116, 139, 0.15)', text: '#94A3B8', border: '#475569', label: 'Agendado' },
  carregando: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: '#D97706', label: 'Carregando na Usina' },
  em_transito: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: '#2563EB', label: 'Em Trânsito' },
  na_obra: { bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: '#9333EA', label: 'Descarregando na Obra' },
  concluido: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ADE80', border: '#16A34A', label: 'Concluído' },
};

export default function ConcretoUsinaERP() {
  const { empresaAtiva } = useAuth();
  const { toast } = useToast();

  const [abaAtiva, setAbaAtiva] = useState('cargas');
  const [cargas, setCargas] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [frota, setFrota] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calculadora de traço
  const [calcVolume, setCalcVolume] = useState(8);
  const [calcFck, setCalcFck] = useState(25);

  // Modal de Romaneio
  const [romaneioSelecionado, setRomaneioSelecionado] = useState(null);

  // Carregar dados
  useEffect(() => {
    carregarDados();
  }, [empresaAtiva]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/concreto/dados').catch(() => null);
      if (res?.ok) {
        setCargas(res.cargas || []);
        setCatalogo(res.catalogo || []);
        setFrota(res.frota || []);
      } else {
        // Fallback com dados estáticos de inicialização
        setCargas(DADOS_CARGAS_FALLBACK);
        setCatalogo(DADOS_CATALOGO_FALLBACK);
        setFrota(DADOS_FROTA_FALLBACK);
      }
    } catch (e) {
      // Ignora erro silenciosamente
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const volProgramado = cargas.reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
    const volConcluido = cargas.filter(c => c.status === 'concluido').reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
    const emOperacao = frota.filter(f => f.status !== 'disponivel').length;
    const fatTotal = cargas.reduce((acc, c) => acc + (Number(c.valorTotal) || 0), 0);
    return { volProgramado, volConcluido, emOperacao, fatTotal };
  }, [cargas, frota]);

  // Traço calculado
  const tracoCalculado = useMemo(() => {
    // Proporções médias por m³ para FCK selecionado
    const bases = {
      20: { cimentoKg: 300, areiaM3: 0.65, britaM3: 0.85, aguaL: 180, aditivoL: 2.4 },
      25: { cimentoKg: 340, areiaM3: 0.62, britaM3: 0.82, aguaL: 175, aditivoL: 2.7 },
      30: { cimentoKg: 380, areiaM3: 0.58, britaM3: 0.80, aguaL: 170, aditivoL: 3.0 },
      35: { cimentoKg: 420, areiaM3: 0.55, britaM3: 0.78, aguaL: 165, aditivoL: 3.4 },
      40: { cimentoKg: 460, areiaM3: 0.52, britaM3: 0.75, aguaL: 160, aditivoL: 3.8 },
    };
    const b = bases[calcFck] || bases[25];
    const v = Number(calcVolume) || 1;
    return {
      cimentoTotalKg: Math.round(b.cimentoKg * v),
      cimentoSacos50: Math.round((b.cimentoKg * v) / 50),
      areiaTotalM3: (b.areiaM3 * v).toFixed(2),
      britaTotalM3: (b.britaM3 * v).toFixed(2),
      aguaTotalL: Math.round(b.aguaL * v),
      aditivoTotalL: (b.aditivoL * v).toFixed(1),
    };
  }, [calcFck, calcVolume]);

  const imprimirRomaneio = () => {
    window.print();
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', color: '#F1F5F9' }}>
      {/* Top Banner de Identidade Visual da Usina */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)'
          }}>
            🚚
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', padding: '3px 10px', borderRadius: 6 }}>
                Usina de Concreto Usinado & Tecnologia
              </span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Tangará da Serra - MT</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
              Serrano Concreto Usinado
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8' }}>
              Programação de cargas, despacho de betoneiras, traços FCK, controle tecnológico de corpos de prova e bombeamento.
            </p>
          </div>
        </div>

        {/* Badges de Registro & Capacidade */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ background: '#0F172A', border: '1px solid #334155', padding: '8px 14px', borderRadius: 10, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Capacidade Usina</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>80 m³ / hora</div>
          </div>
          <div style={{ background: '#0F172A', border: '1px solid #334155', padding: '8px 14px', borderRadius: 10, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>CNPJ Oficial</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>51.499.928/0001-01</div>
          </div>
          <div style={{ background: '#0F172A', border: '1px solid #334155', padding: '8px 14px', borderRadius: 10, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Inscrição Estadual</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>13.567.890-3 (MT)</div>
          </div>
        </div>
      </div>

      {/* Grid de KPIs Operacionais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Volume Programado</span>
            <span style={{ fontSize: 20 }}>📋</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B' }}>
            {kpis.volProgramado} <span style={{ fontSize: 16, fontWeight: 600, color: '#94A3B8' }}>m³</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Total de entregas previstas hoje</div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Volume Já Entregue</span>
            <span style={{ fontSize: 20 }}>✅</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981' }}>
            {kpis.volConcluido} <span style={{ fontSize: 16, fontWeight: 600, color: '#94A3B8' }}>m³</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
            {kpis.volProgramado > 0 ? `${Math.round((kpis.volConcluido / kpis.volProgramado) * 100)}% concluído` : 'Aguardando saída'}
          </div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Frota em Operação</span>
            <span style={{ fontSize: 20 }}>🚛</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#38BDF8' }}>
            {kpis.emOperacao} <span style={{ fontSize: 16, fontWeight: 600, color: '#94A3B8' }}>/ {frota.length}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Betoneiras e bombas ativas</div>
        </div>

        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>Faturamento do Dia</span>
            <span style={{ fontSize: 20 }}>💰</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#FCD34D' }}>
            R$ {kpis.fatTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Concreto + serviços de bomba</div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #334155', paddingBottom: 12, marginBottom: 24, overflowX: 'auto' }}>
        {[
          { id: 'cargas', label: '🚚 Programação de Cargas & Betoneiras', count: cargas.length },
          { id: 'tracos', label: '🏭 Traços & Catálogo FCK', count: catalogo.filter(c => c.categoria === 'Concreto Usinado' || c.categoria === 'Concretos Especiais').length },
          { id: 'calculadora', label: '🧪 Calculadora de Dosagem' },
          { id: 'frota', label: '🚛 Betoneiras & Bombas', count: frota.length },
          { id: 'ensaios', label: '🔬 Corpos de Prova (Slump & FCK)' },
          { id: 'insumos', label: '📦 Silos & Estoque de Insumos' },
        ].map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: abaAtiva === aba.id ? '1px solid #F59E0B' : '1px solid transparent',
              background: abaAtiva === aba.id ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: abaAtiva === aba.id ? '#F59E0B' : '#94A3B8',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {aba.label} {aba.count !== undefined && <span style={{ marginLeft: 6, fontSize: 11, background: '#334155', color: '#E2E8F0', padding: '2px 6px', borderRadius: 10 }}>{aba.count}</span>}
          </button>
        ))}
      </div>

      {/* ABA 1: PROGRAMAÇÃO DE CARGAS */}
      {abaAtiva === 'cargas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
              Programação de Concretagens do Dia
            </h2>
            <button
              onClick={() => toast('Abertura de nova programação de carga', 'info')}
              style={{
                background: '#F59E0B',
                color: '#0F172A',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              + Nova Carga / Obra
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cargas.map(carga => {
              const st = STATUS_CORES[carga.status] || STATUS_CORES.agendado;
              return (
                <div
                  key={carga.id}
                  style={{
                    background: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B' }}>Carga #{carga.numero}</span>
                        <span style={{
                          background: st.bg,
                          color: st.text,
                          border: `1px solid ${st.border}`,
                          padding: '2px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {st.label}
                        </span>
                        <span style={{ fontSize: 13, color: '#94A3B8' }}>Horário: <strong>{carga.horarioAgendado}</strong></span>
                      </div>
                      <h3 style={{ margin: '6px 0 2px', fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>
                        {carga.obra}
                      </h3>
                      <div style={{ fontSize: 13, color: '#CBD5E1' }}>
                        Cliente: <strong>{carga.cliente}</strong> · Endereço: {carga.endereco}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setRomaneioSelecionado(carga)}
                        style={{
                          background: '#334155',
                          color: '#F8FAFC',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        📄 Romaneio Oficial
                      </button>
                    </div>
                  </div>

                  {/* Detalhes técnicos do concreto */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    background: '#0F172A',
                    padding: '12px 16px',
                    borderRadius: 10,
                    marginBottom: 14,
                    border: '1px solid #1E293B'
                  }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Resistência / Traço:</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>{carga.fck}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Slump de Projeto:</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{carga.slump}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Volume Total da Obra:</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#38BDF8' }}>{carga.volumeM3} m³</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Sistema de Descarga:</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{carga.bomba}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Laudo / Corpos de Prova:</span>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#A78BFA' }}>{carga.laudoCp}</div>
                    </div>
                  </div>

                  {/* Viagens das betoneiras */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>
                      Viagens & Caminhões Betoneira Escalados
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                      {carga.viagens.map((v, i) => (
                        <div
                          key={i}
                          style={{
                            background: '#1E293B',
                            border: '1px solid #334155',
                            padding: '10px 14px',
                            borderRadius: 8,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                              🚚 {v.betoneira} · {v.volume} m³
                            </div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>
                              Motorista: {v.motorista}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 11, color: '#CBD5E1' }}>
                            {v.saida ? <div>Saída: <strong>{v.saida}</strong></div> : <div style={{ color: '#F59E0B' }}>Aguardando Usina</div>}
                            {v.fimDescarga ? <div style={{ color: '#10B981' }}>Descarga: {v.fimDescarga}</div> : v.saida && <div style={{ color: '#60A5FA' }}>Em operação</div>}
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

      {/* ABA 2: TRAÇOS & CATÁLOGO */}
      {abaAtiva === 'tracos' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#FFFFFF' }}>
            Tabela de Traços & Resistências de Concreto Usinado
          </h2>
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8' }}>
                  <th style={{ padding: '12px 16px' }}>Produto / Resistência</th>
                  <th style={{ padding: '12px 16px' }}>FCK (MPa)</th>
                  <th style={{ padding: '12px 16px' }}>Slump (cm)</th>
                  <th style={{ padding: '12px 16px' }}>Brita</th>
                  <th style={{ padding: '12px 16px' }}>Proporção Traço</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Preço / m³</th>
                </tr>
              </thead>
              <tbody>
                {catalogo.filter(c => c.categoria === 'Concreto Usinado' || c.categoria === 'Concretos Especiais').map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{item.nome}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{item.descricao}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: '#F59E0B' }}>
                      {item.fck ? `${item.fck} MPa` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#E2E8F0' }}>{item.slump || '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#CBD5E1' }}>{item.brita || 'Brita 1'}</td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#38BDF8' }}>{item.traco || 'Dosagem NBR'}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#FCD34D', fontSize: 15 }}>
                      R$ {item.preco.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: CALCULADORA DE DOSAGEM */}
      {abaAtiva === 'calculadora' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#FFFFFF' }}>
            Calculadora de Dosagem da Central de Concreto (por Carga)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: '#F59E0B' }}>
                1. Parâmetros da Carga da Betoneira
              </h3>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Volume a Carregar (m³):</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="0.5"
                  value={calcVolume}
                  onChange={e => setCalcVolume(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#0F172A', border: '1px solid #334155', color: '#FFFFFF', fontSize: 16, fontWeight: 700 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Resistência Especificada (FCK):</label>
                <select
                  value={calcFck}
                  onChange={e => setCalcFck(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#0F172A', border: '1px solid #334155', color: '#FFFFFF', fontSize: 14, fontWeight: 700 }}
                >
                  <option value={20}>FCK 20 MPa · Pisos e Baldrames</option>
                  <option value={25}>FCK 25 MPa · Lajes, Vigas e Pilares</option>
                  <option value={30}>FCK 30 MPa · Estrutural Pesado / Edifícios</option>
                  <option value={35}>FCK 35 MPa · Pisos Industriais</option>
                  <option value={40}>FCK 40 MPa · Obras Especiais / Pontes</option>
                </select>
              </div>

              <div style={{ background: '#0F172A', padding: 14, borderRadius: 10, fontSize: 12, color: '#94A3B8' }}>
                ℹ️ Esta dosagem calcula a pesagem automatizada das células de carga da usina com correção de umidade de areia e brita conforme a norma ABNT NBR 7212.
              </div>
            </div>

            <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: '#38BDF8' }}>
                2. Balança da Usina · Pesagem Total para {calcVolume} m³
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: 8 }}>
                  <span style={{ color: '#CBD5E1' }}>🧱 Cimento CP II-F-32:</span>
                  <strong style={{ color: '#F59E0B', fontSize: 15 }}>{tracoCalculado.cimentoTotalKg.toLocaleString('pt-BR')} kg ({tracoCalculado.cimentoSacos50} sacos)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: 8 }}>
                  <span style={{ color: '#CBD5E1' }}>🏖️ Areia Média Lavada:</span>
                  <strong style={{ color: '#E2E8F0', fontSize: 15 }}>{tracoCalculado.areiaTotalM3} m³</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: 8 }}>
                  <span style={{ color: '#CBD5E1' }}>🪨 Brita 1 Granítica:</span>
                  <strong style={{ color: '#E2E8F0', fontSize: 15 }}>{tracoCalculado.britaTotalM3} m³</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: 8 }}>
                  <span style={{ color: '#CBD5E1' }}>💧 Água Dosada:</span>
                  <strong style={{ color: '#38BDF8', fontSize: 15 }}>{tracoCalculado.aguaTotalL.toLocaleString('pt-BR')} litros</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0F172A', borderRadius: 8 }}>
                  <span style={{ color: '#CBD5E1' }}>🧪 Aditivo Plastificante:</span>
                  <strong style={{ color: '#A78BFA', fontSize: 15 }}>{tracoCalculado.aditivoTotalL} litros</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: FROTA */}
      {abaAtiva === 'frota' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#FFFFFF' }}>
            Frota de Caminhões Betoneira & Bombas Lança
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {frota.map(caminhao => {
              const isDisp = caminhao.status === 'disponivel';
              return (
                <div
                  key={caminhao.id}
                  style={{
                    background: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#F59E0B' }}>
                      {caminhao.codigo}
                    </span>
                    <span style={{
                      background: isDisp ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: isDisp ? '#4ADE80' : '#60A5FA',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {caminhao.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{caminhao.modelo}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Placa: <strong>{caminhao.placa}</strong> · {caminhao.capacidadeM3 ? `Capacidade: ${caminhao.capacidadeM3} m³` : `Alcance: ${caminhao.alcanceMetros}m`}</div>
                  </div>

                  <div style={{ borderTop: '1px solid #334155', paddingTop: 8, fontSize: 12, color: '#CBD5E1' }}>
                    <div>Motorista / Operador: <strong>{caminhao.motorista || caminhao.operador}</strong></div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Contato: {caminhao.telefone} · Horímetro: {caminhao.horimetro} h</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 5: ENSAIOS & CORPOS DE PROVA */}
      {abaAtiva === 'ensaios' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#FFFFFF' }}>
            Laboratório Tecnológico · Controle de Slump e Ruptura de Corpos de Prova (CP)
          </h2>
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 14, padding: 20 }}>
            <p style={{ color: '#94A3B8', fontSize: 13, margin: '0 0 20px' }}>
              Rastreabilidade oficial conforme as normas NBR 5738 (Moldagem e cura de corpos de prova) e NBR 5739 (Ensaio de compressão de corpos de prova cilíndricos).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {[
                { lote: 'CP-2026-088', obra: 'Ed. Belvedere Tower', fckProjeto: 30, slumpMedido: '14 cm', ruptura7d: '24.8 MPa (82%)', ruptura28d: '34.2 MPa (114%)', status: 'aprovado' },
                { lote: 'CP-2026-089', obra: 'Residencial Serra Dourada', fckProjeto: 30, slumpMedido: '13 cm', ruptura7d: '25.6 MPa (85%)', ruptura28d: 'Aguardando 28d', status: 'em_ensaio' },
                { lote: 'CP-2026-090', obra: 'Galpão AgroLog Transportes', fckProjeto: 35, slumpMedido: '14 cm', ruptura7d: 'Aguardando 7d', ruptura28d: 'Aguardando 28d', status: 'moldado' },
              ].map((ensaio, i) => (
                <div key={i} style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B' }}>{ensaio.lote}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: ensaio.status === 'aprovado' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: ensaio.status === 'aprovado' ? '#4ADE80' : '#60A5FA'
                    }}>
                      {ensaio.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 4 }}>{ensaio.obra}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>FCK de Projeto: <strong>{ensaio.fckProjeto} MPa</strong> · Slump: {ensaio.slumpMedido}</div>
                  <div style={{ borderTop: '1px solid #1E293B', paddingTop: 8, fontSize: 11, color: '#CBD5E1' }}>
                    <div>Rompimento 7 dias: <strong style={{ color: '#FCD34D' }}>{ensaio.ruptura7d}</strong></div>
                    <div>Rompimento 28 dias: <strong style={{ color: '#4ADE80' }}>{ensaio.ruptura28d}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 6: INSUMOS DE USINA */}
      {abaAtiva === 'insumos' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#FFFFFF' }}>
            Estoque Industrial · Silos e Pátio de Agregados
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {catalogo.filter(c => c.categoria === 'Insumos de Usina').map((insumo, i) => (
              <div key={i} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', marginBottom: 4 }}>{insumo.nome}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>{insumo.descricao}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #334155', paddingTop: 10 }}>
                  <span style={{ fontSize: 12, color: '#CBD5E1' }}>Estoque Atual:</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: insumo.estoqueAtual <= insumo.estoqueMinimo ? '#EF4444' : '#10B981' }}>
                    {insumo.estoqueAtual} <span style={{ fontSize: 13, fontWeight: 600 }}>{insumo.unidade}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DE ROMANEIO OFICIAL DE CONCRETAGEM */}
      {romaneioSelecionado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#FFFFFF',
            color: '#0F172A',
            width: '100%',
            maxWidth: 720,
            borderRadius: 14,
            padding: 32,
            boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Cabeçalho do Romaneio */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#D97706' }}>SERRANO CONCRETO USINADO</div>
                <div style={{ fontSize: 11, color: '#475569' }}>SERRANO CONCRETO E ARTEFATOS DE CIMENTO LTDA</div>
                <div style={{ fontSize: 11, color: '#475569' }}>CNPJ: 51.499.928/0001-01 · IE: 13.567.890-3</div>
                <div style={{ fontSize: 11, color: '#475569' }}>Av. Inácio Bittencourt Cardoso, s/n · Tangará da Serra/MT</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>ROMANEIO DE ENTREGA</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#DC2626' }}>Nº {romaneioSelecionado.numero}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Data: 11/11/2026</div>
              </div>
            </div>

            {/* Dados da Obra */}
            <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 12, border: '1px solid #E2E8F0' }}>
              <div><strong>CLIENTE:</strong> {romaneioSelecionado.cliente}</div>
              <div style={{ marginTop: 4 }}><strong>OBRA:</strong> {romaneioSelecionado.obra}</div>
              <div style={{ marginTop: 4 }}><strong>LOCAL:</strong> {romaneioSelecionado.endereco}</div>
            </div>

            {/* Especificação do Concreto */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 12 }}>
              <div style={{ border: '1px solid #CBD5E1', padding: 10, borderRadius: 6 }}>
                <div><strong>RESISTÊNCIA:</strong> {romaneioSelecionado.fck}</div>
                <div style={{ marginTop: 4 }}><strong>SLUMP ESPECIFICADO:</strong> {romaneioSelecionado.slump}</div>
              </div>
              <div style={{ border: '1px solid #CBD5E1', padding: 10, borderRadius: 6 }}>
                <div><strong>VOLUME TOTAL:</strong> {romaneioSelecionado.volumeM3} m³</div>
                <div style={{ marginTop: 4 }}><strong>SISTEMA:</strong> {romaneioSelecionado.bomba}</div>
              </div>
            </div>

            {/* Tabela de Viagens */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20 }}>
              <thead>
                <tr style={{ background: '#E2E8F0', borderBottom: '1px solid #94A3B8' }}>
                  <th style={{ padding: 6, textAlign: 'left' }}>Betoneira</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>Motorista</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Volume</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Saída Usina</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Chegada Obra</th>
                  <th style={{ padding: 6, textAlign: 'center' }}>Fim Descarga</th>
                </tr>
              </thead>
              <tbody>
                {romaneioSelecionado.viagens.map((v, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: 6 }}><strong>{v.betoneira}</strong></td>
                    <td style={{ padding: 6 }}>{v.motorista}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.volume} m³</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.saida || '—'}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.chegada || '—'}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>{v.fimDescarga || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Campo de Assinatura */}
            <div style={{ borderTop: '1px dashed #94A3B8', paddingTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 11, textAlign: 'center', marginTop: 32 }}>
              <div style={{ width: '45%' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>Assinatura do Motorista / Usina</div>
              </div>
              <div style={{ width: '45%' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>Assinatura do Responsável na Obra</div>
              </div>
            </div>

            {/* Botões do modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setRomaneioSelecionado(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Fechar
              </button>
              <button
                onClick={imprimirRomaneio}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#D97706', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
              >
                🖨️ Imprimir Romaneio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}