import React from 'react';
import { 
  FileText, 
  Weight, 
  Truck, 
  Timer, 
  Sparkles, 
  AlertTriangle 
} from 'lucide-react';

export default function KPICards({ stats, onSelectExceptionCard }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      
      {/* 1. Pesagens Hoje */}
      <div className="bg-white p-3.5 rounded-xl border border-concrete-200 shadow-xs hover:border-stone-300 transition-all">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1 flex items-center justify-between">
          <span>Pesagens Hoje</span>
          <FileText className="w-3.5 h-3.5 text-stone-400" />
        </div>
        <div className="text-2xl font-black text-stone-900 tracking-tight">
          {stats.pesagensHoje}
        </div>
        <div className="text-[11px] text-stone-500 font-medium mt-0.5">
          tickets emitidos
        </div>
      </div>

      {/* 2. Movimentado */}
      <div className="bg-white p-3.5 rounded-xl border border-concrete-200 shadow-xs hover:border-stone-300 transition-all">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1 flex items-center justify-between">
          <span>Movimentado</span>
          <Weight className="w-3.5 h-3.5 text-stone-400" />
        </div>
        <div className="text-2xl font-black text-stone-900 tracking-tight">
          {stats.movimentadoTon.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          <span className="text-sm font-semibold text-stone-500 ml-0.5">t</span>
        </div>
        <div className="text-[11px] text-stone-500 font-medium mt-0.5">
          entrada + saída
        </div>
      </div>

      {/* 3. Veículos no Site */}
      <div className="bg-white p-3.5 rounded-xl border border-concrete-200 shadow-xs hover:border-stone-300 transition-all">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1 flex items-center justify-between">
          <span>Veículos no Site</span>
          <Truck className="w-3.5 h-3.5 text-stone-400" />
        </div>
        <div className="text-2xl font-black text-stone-900 tracking-tight">
          {stats.veiculosNoSite}
        </div>
        <div className="text-[11px] text-stone-500 font-medium mt-0.5">
          {stats.veiculosFila} na fila · {stats.veiculosPatio} no pátio
        </div>
      </div>

      {/* 4. Espera Média */}
      <div className="bg-white p-3.5 rounded-xl border border-concrete-200 shadow-xs hover:border-stone-300 transition-all">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1 flex items-center justify-between">
          <span>Espera Média</span>
          <Timer className="w-3.5 h-3.5 text-stone-400" />
        </div>
        <div className="text-2xl font-black text-stone-900 tracking-tight">
          {stats.esperaMediaMin.toLocaleString('pt-BR')}
          <span className="text-sm font-semibold text-stone-500 ml-0.5">min</span>
        </div>
        <div className="text-[11px] text-stone-500 font-medium mt-0.5">
          da portaria à balança
        </div>
      </div>

      {/* 5. Sem Intervenção */}
      <div className="bg-white p-3.5 rounded-xl border border-concrete-200 shadow-xs hover:border-stone-300 transition-all">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center justify-between">
          <span>Sem Intervenção</span>
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="text-2xl font-black text-emerald-700 tracking-tight">
          {stats.semIntervencaoPct}%
        </div>
        <div className="text-[11px] text-stone-500 font-medium mt-0.5">
          pesagens 100% automáticas
        </div>
      </div>

      {/* 6. Exceções Abertas */}
      <div 
        onClick={onSelectExceptionCard}
        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
          stats.excecoesAbertas > 0
            ? 'bg-rose-50/80 border-rose-300 shadow-xs hover:border-rose-400 hover:shadow-sm'
            : 'bg-white border-concrete-200'
        }`}
        title="Clique para auditar as exceções com o Motor KyttoIA"
      >
        <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-1 flex items-center justify-between">
          <span>Exceções Abertas</span>
          <AlertTriangle className={`w-3.5 h-3.5 ${stats.excecoesAbertas > 0 ? 'text-rose-600 animate-bounce' : 'text-stone-400'}`} />
        </div>
        <div className="text-2xl font-black text-rose-700 tracking-tight">
          {stats.excecoesAbertas}
        </div>
        <div className="text-[11px] text-rose-600 font-semibold mt-0.5 flex items-center gap-1">
          <span>aguardando decisão</span>
          <span className="text-[10px] underline">→</span>
        </div>
      </div>

    </div>
  );
}
