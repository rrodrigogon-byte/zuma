import React from 'react';
import { 
  Building, 
  Scale, 
  CalendarClock, 
  ShieldCheck, 
  Users, 
  Receipt, 
  BarChart3, 
  Database,
  ChevronLeft,
  ChevronRight,
  Cpu
} from 'lucide-react';

export const MODULES = [
  { id: 'torre', label: 'Torre', icon: Building, badge: null, desc: 'Torre de Controle & Gêmeo Digital' },
  { id: 'pesagem', label: 'Pesagem', icon: Scale, badge: 'Live', badgeColor: 'bg-emerald-500 text-white', desc: 'Cockpit de Balança Operacional' },
  { id: 'fila', label: 'Fila & agenda', icon: CalendarClock, badge: null, desc: 'Fila de Caminhões & Concretagens' },
  { id: 'antifraude', label: 'Antifraude', icon: ShieldCheck, badge: '1', badgeColor: 'bg-rose-500 text-white animate-pulse', desc: 'Auditoria Inteligente KyttoIA' },
  { id: 'clientes', label: 'Clientes', icon: Users, badge: null, desc: 'Canteiros de Obras & Pedidos' },
  { id: 'fiscal', label: 'Fiscal & integrações', icon: Receipt, badge: 'SEFAZ', badgeColor: 'bg-blue-500 text-white', desc: 'MDF-e, NF-e e CT-e' },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, badge: null, desc: 'Indicadores & Consumo de Insumos' },
  { id: 'cadastros', label: 'Cadastros & regras', icon: Database, badge: null, desc: 'Traços NBR, Frotas e Balanças' },
];

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, stats }) {
  return (
    <aside className={`bg-white border-r border-concrete-200 flex flex-col justify-between transition-all duration-200 select-none z-20 ${
      isCollapsed ? 'w-16' : 'w-56'
    }`}>
      {/* Navigation Items */}
      <div className="p-2 space-y-1">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isActive = activeTab === mod.id;
          
          return (
            <button
              key={mod.id}
              onClick={() => setActiveTab(mod.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all group relative ${
                isActive 
                  ? 'bg-serrano-50 text-serrano-700 shadow-xs border border-serrano-200/80 font-bold' 
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900 border border-transparent'
              }`}
              title={isCollapsed ? `${mod.label} - ${mod.desc}` : undefined}
            >
              {/* Icon Container with subtle active indicator */}
              <div className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                isActive ? 'bg-serrano-500 text-white' : 'text-stone-500 group-hover:text-stone-800 group-hover:bg-stone-100'
              }`}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Text Label */}
              {!isCollapsed && (
                <div className="flex-1 truncate">
                  <span className="truncate block leading-tight">{mod.label}</span>
                </div>
              )}

              {/* Badge */}
              {!isCollapsed && mod.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${mod.badgeColor || 'bg-stone-200 text-stone-700'}`}>
                  {mod.id === 'antifraude' ? stats.excecoesAbertas : mod.badge}
                </span>
              )}

              {/* Small dot for collapsed state with badge */}
              {isCollapsed && mod.badge && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Branding & Collapse Button */}
      <div className="p-3 border-t border-concrete-100 bg-concrete-50/50">
        {!isCollapsed && (
          <div className="mb-2.5 p-2 rounded-lg bg-stone-100/80 border border-stone-200 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-stone-700 mb-0.5">
              <Cpu className="w-3.5 h-3.5 text-serrano-600" />
              <span>Motor KyttoIA 2.5</span>
            </div>
            <p className="text-[10px] text-stone-500 leading-snug">
              Antifraude de pesagem, OCR e telemetria ativa 24/7.
            </p>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          title={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Recolher painel</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
