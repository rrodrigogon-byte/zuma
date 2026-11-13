import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Camera, 
  Scale, 
  CheckCircle2, 
  Sliders, 
  History, 
  FileCheck,
  TrendingDown,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { FRAUD_RULES } from '../data/mockData';

export default function AntiFraud({ onOpenDecisionModal }) {
  const [selectedRule, setSelectedRule] = useState(FRAUD_RULES[0]);

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
              <span>MÓDULO ANTIFRAUDE & AUDITORIA DE PESAGEM</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Motor KyttoIA 2.5
              </span>
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Detecção automática de desvio de tara histórica, lastro oculto de água, rodado fora da plataforma e dupla pesagem
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-500">Conformidade Operacional:</span>
          <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            99.1%
          </span>
        </div>
      </div>

      {/* Active Incident Showcase (NJK-3307) */}
      <div className="bg-rose-50/90 rounded-2xl border-2 border-rose-300 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-rose-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-900 uppercase tracking-wide">
                  INCIDENTE ATIVO · NJK-3307
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
                  Risco Crítico (78/100)
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-stone-900 mt-0.5">
                Desvio de Tara Histórica Suspeito (+6.1% / +590 kg)
              </h3>
            </div>
          </div>

          <button
            onClick={() => onOpenDecisionModal && onOpenDecisionModal({
              titulo: 'Tara fora do padrão · NJK-3307',
              detalhes: 'Tara 10.190 kg vs média histórica 9.600 kg (+6,1%). Padrão de lastro oculto antes da pesagem de saída.',
              veiculoPlaca: 'NJK-3307'
            })}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors self-start md:self-auto"
          >
            <span>Auditar & Decidir Agora</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
          </button>
        </div>

        {/* Forensic Evidence Analysis Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-rose-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              DIAGNÓSTICO MOTOR KYTTOIA
            </span>
            <p className="text-stone-700 mt-1 leading-snug">
              Veículo registrou <strong className="text-rose-700 font-mono">10.190 kg</strong> na entrada. A média dos últimos 42 carregamentos é <strong className="text-stone-800 font-mono">9.600 kg</strong>. Há indício de tanque de lastro ou estepe duplo adicionado antes da pesagem.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-rose-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              IMPACTO FINANCEIRO ESTIMADO
            </span>
            <div className="text-lg font-mono font-black text-rose-700 mt-1">
              R$ 88,50 / carga
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Se o lastro for descartado no canteiro, 590 kg de agregado seriam entregues a menor sem faturamento.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-rose-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              SENSORES ÓPTICOS & CÂMERAS
            </span>
            <p className="text-stone-700 mt-1 leading-snug">
              Câmera BM-02 detectou 3 eixos posicionados corretamente. Não há corte de feixe lateral. Suspeita concentrada exclusivamente na tara adulterada.
            </p>
          </div>
        </div>
      </div>

      {/* Rules & Sensitivity Configuration */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 mb-3 flex items-center justify-between">
          <span>Regras de Proteção de Pesagem Ativas</span>
          <span className="text-[10px] text-stone-500 font-normal">Supervisionadas pelo Motor KyttoIA</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FRAUD_RULES.map(rule => (
            <div 
              key={rule.id}
              className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-stone-50 hover:border-stone-300 transition-all text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-serrano-700 block">
                    {rule.codigo}
                  </span>
                  <h4 className="font-bold text-stone-900 mt-0.5">
                    {rule.nome}
                  </h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {rule.status}
                </span>
              </div>

              <p className="text-[11px] text-stone-600 mt-1.5 leading-relaxed">
                {rule.descricao}
              </p>

              <div className="mt-2.5 pt-2 border-t border-stone-200 flex items-center justify-between text-[10px]">
                <span className="text-stone-500 font-medium">
                  Sensibilidade: <strong className="text-stone-800">{rule.sensibilidade}</strong>
                </span>
                <span className="font-mono text-stone-600">
                  Hoje: <strong>{rule.ocorrenciasHoje}</strong> ocorrência(s)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs text-xs">
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 mb-3">
          Histórico de Auditorias Automáticas Recentes
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                <th className="py-2">Horário</th>
                <th>Placa / Prefixo</th>
                <th>Operação</th>
                <th>Tara Medida</th>
                <th>Tara Média</th>
                <th>Desvio</th>
                <th>Status KyttoIA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              <tr>
                <td className="py-2.5 font-mono">13:34</td>
                <td className="font-bold text-stone-900">NJK-3307 (CC-03)</td>
                <td>1ª Pesagem BAL-02</td>
                <td className="font-mono text-rose-700 font-bold">10.190 kg</td>
                <td className="font-mono">9.600 kg</td>
                <td className="font-mono text-rose-700 font-bold">+6.1%</td>
                <td><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Bloqueado</span></td>
              </tr>
              <tr>
                <td className="py-2.5 font-mono">13:33</td>
                <td className="font-bold text-stone-900">QBF-6M02 (BT-05)</td>
                <td>1ª Pesagem BAL-01</td>
                <td className="font-mono">12.920 kg</td>
                <td className="font-mono">12.900 kg</td>
                <td className="font-mono text-emerald-700">+0.15%</td>
                <td><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Conforme</span></td>
              </tr>
              <tr>
                <td className="py-2.5 font-mono">13:20</td>
                <td className="font-bold text-stone-900">RRA-4A20 (BT-06)</td>
                <td>1ª Pesagem BAL-01</td>
                <td className="font-mono">11.480 kg</td>
                <td className="font-mono">11.500 kg</td>
                <td className="font-mono text-emerald-700">-0.17%</td>
                <td><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Conforme</span></td>
              </tr>
              <tr>
                <td className="py-2.5 font-mono">13:05</td>
                <td className="font-bold text-stone-900">OBX-9K31 (BT-12)</td>
                <td>2ª Pesagem BAL-01</td>
                <td className="font-mono">30.820 kg</td>
                <td className="font-mono">30.800 kg</td>
                <td className="font-mono text-emerald-700">+0.06%</td>
                <td><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Liberado</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
