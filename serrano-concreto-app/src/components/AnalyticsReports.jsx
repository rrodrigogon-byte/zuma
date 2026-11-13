import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Clock, 
  Layers, 
  Weight, 
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function AnalyticsReports({ stats, silos }) {
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

        <div className="text-xs font-mono font-bold text-stone-700 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
          Fechamento Parcial: 13:36
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        
        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            CONCRETO EXPEDIDO HOJE
          </div>
          <div className="text-2xl font-black text-stone-900 mt-1 font-mono">
            {stats.concretoProduzidoM3} <span className="text-sm font-sans font-bold text-stone-500">m³</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.2% vs média do mês</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            AGREGADOS MINERAÇÃO
          </div>
          <div className="text-2xl font-black text-stone-900 mt-1 font-mono">
            {stats.agregadosExpedidosTon} <span className="text-sm font-sans font-bold text-stone-500">t</span>
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
            Meta operacional: &gt; 85%
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            TAKT TIME MÉDIO DO CICLO
          </div>
          <div className="text-2xl font-black text-stone-900 mt-1 font-mono">
            {stats.esperaMediaMin} <span className="text-sm font-sans font-bold text-stone-500">min</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            Eficiência da balança: 98%
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
                  <span>{silo.codigo} · {silo.tipo}</span>
                  <span className="font-mono text-serrano-700">{silo.nivelPct}%</span>
                </div>

                <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${silo.nivelPct < 40 ? 'bg-amber-500' : 'bg-serrano-500'}`}
                    style={{ width: `${silo.nivelPct}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500">
                  <span>Atual: <strong className="text-stone-800 font-mono">{silo.nivelAtualTon} t</strong> de {silo.capacidadeTotalTon} t</span>
                  <span>Consumo hoje: <strong className="text-stone-800 font-mono">{silo.consumoHojeTon} t</strong></span>
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

    </div>
  );
}
