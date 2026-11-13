import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Clock, 
  Layers, 
  Weight, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Calendar,
  Leaf,
  FileSpreadsheet,
  Building2,
  DollarSign
} from 'lucide-react';

export default function AnalyticsReports({ stats, silos }) {
  const [period, setPeriod] = useState('hoje'); // 'hoje' | 'semana' | 'mes'

  // Multipliers according to period
  const mult = period === 'hoje' ? 1 : period === 'semana' ? 6.2 : 24.5;

  const concretoM3 = Math.round(stats.concretoProduzidoM3 * mult);
  const agregadosTon = Math.round(stats.agregadosExpedidosTon * mult);
  const ticketsCount = Math.round(stats.pesagensHoje * mult);
  const faturamentoEstimado = Math.round(concretoM3 * 485 + agregadosTon * 62);

  // Concrete classes breakdown
  const fckBreakdown = [
    { classe: 'FCK 20 MPa (Piso/Calçada)', m3: Math.round(concretoM3 * 0.12), pct: 12, cor: 'bg-stone-400' },
    { classe: 'FCK 25 MPa (Estrutural Padrão)', m3: Math.round(concretoM3 * 0.28), pct: 28, cor: 'bg-amber-500' },
    { classe: 'FCK 30 MPa (Bombeável Lajes)', m3: Math.round(concretoM3 * 0.42), pct: 42, cor: 'bg-serrano-500' },
    { classe: 'FCK 35 MPa (Pilares e Vigas)', m3: Math.round(concretoM3 * 0.11), pct: 11, cor: 'bg-emerald-600' },
    { classe: 'FCK 40 MPa ARI (Alta Resistência)', m3: Math.round(concretoM3 * 0.07), pct: 7, cor: 'bg-blue-600' },
  ];

  // CSV Export Handler
  const handleExportCsv = () => {
    const rows = [
      ['Data', 'Ticket', 'Balança', 'Placa', 'Motorista', 'Produto / Traço', 'FCK (MPa)', 'Volume (m³)', 'Tara (kg)', 'Bruto (kg)', 'Líquido (kg)', 'Status SEFAZ'],
      ['13/11/2026 13:30', 'TKT-2026-0075', 'BAL-01 Toledo', 'QBF-6M02', 'Valdir Silveira', 'TR-FCK30B', '30', '8.66', '12920', '33540', '20620', 'Autorizada SEFAZ-MT'],
      ['13/11/2026 11:42', 'TKT-2026-0074', 'BAL-02 Filizola', 'QBM-4J11', 'José Roberto Lima', 'Pedra Britada nº 1', '-', '20.00', '14850', '46200', '31350', 'Autorizada SEFAZ-MT'],
      ['13/11/2026 10:15', 'TKT-2026-0073', 'BAL-01 Toledo', 'QBC-8821', 'Carlos Eduardo Ramos', 'TR-FCK25', '25', '8.00', '12800', '31840', '19040', 'Autorizada SEFAZ-MT'],
      ['13/11/2026 09:30', 'TKT-2026-0072', 'BAL-01 Toledo', 'RAA-4A20', 'Marcos Vinicius', 'TR-FCK30B', '30', '10.00', '12950', '36780', '23830', 'Autorizada SEFAZ-MT'],
      ['13/11/2026 08:45', 'TKT-2026-0071', 'BAL-02 Filizola', 'OBX-9K31', 'Antônio Fagundes', 'Areia Média Lavada', '-', '18.50', '14200', '43800', '29600', 'Autorizada SEFAZ-MT'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_pesagem_serrano_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>RELATÓRIOS EXECUTIVOS & ANALYTICS OPERACIONAL</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-serrano-100 text-serrano-800 border border-serrano-200">
              Dashboard C-Level
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Throughput de concreto, expedição de agregados, índice de automação sem operador e consumo de insumos
          </p>
        </div>

        {/* Period Selector & Export Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-stone-100 p-1 rounded-xl text-xs font-bold border border-stone-200">
            <button
              onClick={() => setPeriod('hoje')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'hoje' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriod('semana')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'semana' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Últimos 7 dias
            </button>
            <button
              onClick={() => setPeriod('mes')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'mes' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Mês Atual
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            title="Exportar planilha oficial das pesagens em formato CSV / Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            CONCRETO EXPEDIDO
          </div>
          <div className="text-2xl font-black text-stone-900 mt-1 font-mono">
            {concretoM3.toLocaleString('pt-BR')} <span className="text-sm font-sans font-bold text-stone-500">m³</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.2% vs período anterior</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            AGREGADOS MINERAÇÃO
          </div>
          <div className="text-2xl font-black text-stone-900 mt-1 font-mono">
            {agregadosTon.toLocaleString('pt-BR')} <span className="text-sm font-sans font-bold text-stone-500">t</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1 font-medium">
            Areia média lavada & brita 1
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            PESAGENS SEM OPERADOR
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {stats.semIntervencaoPct}%
          </div>
          <div className="text-[11px] text-stone-500 mt-1 font-medium">
            {ticketsCount} tickets auditados
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            FATURAMENTO ESTIMADO
          </div>
          <div className="text-2xl font-black text-serrano-700 mt-1 font-mono">
            R$ {(faturamentoEstimado / 1000).toFixed(1)}k
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            Concreto + Agregados + Frete
          </div>
        </div>
      </div>

      {/* Interactive Charts: Hourly Throughput & Silo Consumption */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Hourly Production Curve (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 flex items-center justify-between">
            <span>Throughput Horário de Concreto Usinado (m³/hora)</span>
            <span className="text-[10px] text-stone-400 font-normal">Capacidade máx Convicta: 96 m³/h</span>
          </h3>

          {/* Bar Chart Representation */}
          <div className="pt-4 h-48 flex items-end gap-3 px-2 border-b border-stone-200">
            {[
              { hora: '07h', m3: 24, max: 80 },
              { hora: '08h', m3: 56, max: 80 },
              { hora: '09h', m3: 78, max: 80 },
              { hora: '10h', m3: 84, max: 80 },
              { hora: '11h', m3: 62, max: 80 },
              { hora: '12h', m3: 28, max: 80 },
              { hora: '13h', m3: 80, max: 80 },
            ].map(col => {
              const heightPct = Math.round((col.m3 / col.max) * 100);
              return (
                <div key={col.hora} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[10px] font-mono font-bold text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {col.m3}m³
                  </span>
                  <div className="w-full bg-stone-100 rounded-t-lg h-36 relative overflow-hidden flex items-end">
                    <div 
                      className="w-full bg-gradient-to-t from-serrano-600 to-amber-500 rounded-t-lg transition-all duration-500 group-hover:brightness-110"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-stone-500">{col.hora}</span>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-stone-500 pt-1 flex items-center justify-between">
            <span>Pico registrado: <strong className="text-stone-800">10h (84 m³/h)</strong> para canteiro Hospital Regional</span>
            <span className="text-emerald-700 font-semibold">Sem gargalos na balança BAL-01</span>
          </div>
        </div>

        {/* Right: Silo Stock & Consumption (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 flex items-center justify-between">
            <span>Nível dos Silos & Previsão de Estoque</span>
            <span className="text-[10px] text-stone-400 font-normal">Silos Verticais MT-358</span>
          </h3>

          <div className="space-y-3 text-xs">
            {silos.map(silo => (
              <div key={silo.id} className="p-3 rounded-xl border border-stone-200 bg-stone-50/70">
                <div className="flex items-center justify-between font-bold text-stone-900 mb-1">
                  <span>{silo.codigo || silo.id} · {silo.tipo || silo.nome}</span>
                  <span className="font-mono text-serrano-700">{silo.nivelPct != null ? silo.nivelPct : 0}%</span>
                </div>
                <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${(silo.nivelPct || 0) < 40 ? 'bg-amber-500' : 'bg-serrano-500'}`}
                    style={{ width: `${silo.nivelPct || 0}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500">
                  <span>Atual: <strong className="text-stone-800 font-mono">{silo.nivelAtualTon || silo.atualTons || 0} t</strong> de {silo.capacidadeTotalTon || silo.capacidadeTons || 100} t</span>
                  <span>Consumo hoje: <strong className="text-stone-800 font-mono">{silo.consumoHojeTon || silo.consumoHojeTons || 0} t</strong></span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Aviso de Recarga:</strong> O Silo 03 (Pozolana) atingirá nível de segurança às 17h00. Pedido de recarga de 30t já confirmado com a transportadora.
            </div>
          </div>
        </div>

      </div>

      {/* CONCRETE CLASSES BREAKDOWN & SUSTAINABILITY SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* FCK Classes Breakdown (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 flex items-center justify-between">
            <span>Distribuição por Classe de Resistência FCK</span>
            <span className="text-[10px] text-stone-400 font-normal">Norma ABNT NBR 8953 / NBR 12655</span>
          </h3>

          <div className="space-y-2.5 pt-2">
            {fckBreakdown.map((item, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-semibold text-stone-800">{item.classe}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-stone-900">{item.m3} m³</span>
                    <span className="text-stone-400 font-normal">({item.pct}%)</span>
                  </div>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.cor}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sustainability & Carbon Footprint (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
              <Leaf className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800">
                Pegada de Carbono NBR ISO 14067
              </h3>
              <p className="text-[10px] text-stone-400">Descarbonização & Pozolana Ativa</p>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-emerald-900 font-semibold">Emissão Média da Usina:</span>
              <strong className="font-mono text-emerald-800 text-sm">184 kg CO₂/m³</strong>
            </div>
            <div className="flex justify-between items-center text-[11px] text-stone-600">
              <span>Benchmark de Mercado:</span>
              <span className="font-mono">295 kg CO₂/m³</span>
            </div>
            <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-[11px] font-bold text-emerald-800">
              <span>Redução de CO₂ Alcançada:</span>
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px]">-37.6%</span>
            </div>
          </div>

          <p className="text-[11px] text-stone-500 leading-relaxed">
            A substituição parcial de clínquer por pozolana no Silo 03 e o uso de agregados locais da Mineração Rio Sangue reduzem o transporte rodoviário e garantem o <strong>Selo Verde Serrano</strong>.
          </p>
        </div>

      </div>

    </div>
  );
}
