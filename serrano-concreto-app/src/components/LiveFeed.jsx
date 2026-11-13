import React, { useState } from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  Scale, 
  Receipt, 
  Clock, 
  CheckCircle2, 
  Filter,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export default function LiveFeed({ events, onOpenDecisionModal, onSelectEvent }) {
  const [activeFilter, setActiveFilter] = useState('tudo');

  const filteredEvents = events.filter(evt => {
    if (activeFilter === 'tudo') return true;
    if (activeFilter === 'ia') return evt.categoria === 'KyttoIA';
    if (activeFilter === 'excecoes') return evt.severidade === 'critico' || evt.tipo === 'ia_alerta';
    if (activeFilter === 'fiscal') return evt.categoria === 'Fiscal';
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-concrete-200 shadow-xs p-4 flex flex-col h-full">
      
      {/* Feed Header */}
      <div className="flex items-center justify-between pb-3 border-b border-concrete-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-stone-900">
            AGORA
          </h2>
          <span className="text-[10px] font-mono text-stone-400">
            ({filteredEvents.length})
          </span>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg text-xs">
          {[
            { id: 'tudo', label: 'Tudo' },
            { id: 'ia', label: 'KyttoIA' },
            { id: 'excecoes', label: 'Exceções' },
            { id: 'fiscal', label: 'Fiscal' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                activeFilter === tab.id
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Stream List */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[520px]">
        {filteredEvents.map(evt => {
          const isCritical = evt.severidade === 'critico';
          const isIA = evt.categoria === 'KyttoIA';

          return (
            <div
              key={evt.id}
              onClick={() => onSelectEvent && onSelectEvent(evt)}
              className={`p-3 rounded-xl border transition-all text-xs cursor-pointer ${
                isCritical 
                  ? 'bg-rose-50/90 border-rose-200 hover:border-rose-400 shadow-xs' 
                  : isIA
                  ? 'bg-amber-50/40 border-amber-200/70 hover:border-amber-300'
                  : 'bg-stone-50/70 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {/* Event Top Bar: Time & Category */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
                  <Clock className="w-3 h-3 text-stone-400" />
                  <span className="font-semibold text-stone-700">{evt.hora}</span>
                </div>

                <div className="flex items-center gap-1">
                  {isIA && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      KyttoIA
                    </span>
                  )}
                  {isCritical && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 flex items-center gap-0.5 animate-pulse">
                      <ShieldAlert className="w-2.5 h-2.5 text-rose-700" />
                      Atenção
                    </span>
                  )}
                  {evt.categoria === 'Fiscal' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                      SEFAZ
                    </span>
                  )}
                </div>
              </div>

              {/* Event Title */}
              <div className={`font-bold text-xs leading-snug ${isCritical ? 'text-rose-900' : 'text-stone-900'}`}>
                {evt.titulo}
              </div>

              {/* Event Description / Details */}
              <div className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                {evt.detalhes}
              </div>

              {/* Direct Action Button if Available (e.g. Decidir) */}
              {evt.acao && (
                <div className="mt-2.5 pt-2 border-t border-rose-200/80 flex items-center justify-between">
                  <span className="text-[10px] text-rose-600 font-medium">
                    Ação requerida pela Torre
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDecisionModal && onOpenDecisionModal(evt);
                    }}
                    className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center gap-1 transition-all active:scale-95"
                  >
                    <span>{evt.acao.rotulo}</span>
                    <ArrowRight className="w-3 h-3 text-amber-300" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Feed Footer */}
      <div className="mt-2 pt-2 border-t border-concrete-100 text-[10px] text-stone-400 text-center font-medium">
        Eventos transmitidos em tempo real via WebSocket Kytto
      </div>

    </div>
  );
}
