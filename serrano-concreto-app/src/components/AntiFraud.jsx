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
  ArrowRight,
  Activity,
  Layers,
  Cpu,
  RefreshCw,
  Search,
  Check
} from 'lucide-react';
import { FRAUD_RULES } from '../data/mockData';

export default function AntiFraud({ onOpenDecisionModal }) {
  const [selectedRule, setSelectedRule] = useState(FRAUD_RULES[0]);
  const [sensitivity, setSensitivity] = useState(2.5); // % tolerância de tara
  const [activeCellView, setActiveCellView] = useState('bal01'); // 'bal01' | 'bal02'

  // Simulated 8 load cells telemetries for 21m bridge Toledo DLC-10t
  const loadCells = [
    { id: 'DLC-01', posicao: 'Par 1 · Diant. Esq.', pesoKg: 1618, capacidadeTon: 10, status: 'ok', voltagem: '12.04 mV' },
    { id: 'DLC-02', posicao: 'Par 1 · Diant. Dir.', pesoKg: 1622, capacidadeTon: 10, status: 'ok', voltagem: '12.06 mV' },
    { id: 'DLC-03', posicao: 'Par 2 · Interm. 1 Esq.', pesoKg: 1612, capacidadeTon: 10, status: 'ok', voltagem: '12.01 mV' },
    { id: 'DLC-04', posicao: 'Par 2 · Interm. 1 Dir.', pesoKg: 1616, capacidadeTon: 10, status: 'ok', voltagem: '12.03 mV' },
    { id: 'DLC-05', posicao: 'Par 3 · Interm. 2 Esq.', pesoKg: 1620, capacidadeTon: 10, status: 'ok', voltagem: '12.05 mV' },
    { id: 'DLC-06', posicao: 'Par 3 · Interm. 2 Dir.', pesoKg: 1614, capacidadeTon: 10, status: 'ok', voltagem: '12.02 mV' },
    { id: 'DLC-07', posicao: 'Par 4 · Tras. Esq.', pesoKg: 1608, capacidadeTon: 10, status: 'ok', voltagem: '11.98 mV' },
    { id: 'DLC-08', posicao: 'Par 4 · Tras. Dir.', pesoKg: 1610, capacidadeTon: 10, status: 'ok', voltagem: '11.99 mV' },
  ];

  const totalCellWeight = loadCells.reduce((acc, c) => acc + c.pesoKg, 0);

  // Forensic Audit Log Table
  const auditLogs = [
    {
      id: 'AUD-2026-0041',
      hora: '13:34',
      placa: 'NJK-3307',
      prefixo: 'CB-03',
      tipo: 'Caçamba Basculante (3 Eixos)',
      risco: 78,
      status: 'critico',
      diagnostico: 'Desvio de Tara (+6,1% / +590 kg) · Suspeita de Lastro de Água',
      acaoTomada: 'Retido na Baia de Exceção · Semáforo Bloqueado'
    },
    {
      id: 'AUD-2026-0040',
      hora: '13:30',
      placa: 'QBF-6M02',
      prefixo: 'BT-05',
      tipo: 'Betoneira 10m³ (4 Eixos)',
      risco: 2,
      status: 'aprovado',
      diagnostico: 'Tara conforme média histórica (12.920 kg vs 12.910 kg) · 100% sobre as células',
      acaoTomada: 'Liberado para Carregamento Convicta 96T'
    },
    {
      id: 'AUD-2026-0039',
      hora: '11:42',
      placa: 'QBM-4J11',
      prefixo: 'CB-01',
      tipo: 'Caminhão Traçado 6x4',
      risco: 5,
      status: 'aprovado',
      diagnostico: 'Auditoria LPR + Balança OK · Agregado Basalto Rio Sangue',
      acaoTomada: 'Ticket TKT-0074 Emitido com Sucesso'
    },
    {
      id: 'AUD-2026-0038',
      hora: '10:15',
      placa: 'QBC-8821',
      prefixo: 'BT-03',
      tipo: 'Betoneira 8m³ (3 Eixos)',
      risco: 4,
      status: 'aprovado',
      diagnostico: 'Traço TR-FCK25 · NBR 7212 conferida · Semáforo Verde',
      acaoTomada: 'Ticket TKT-0073 Emitido com Sucesso'
    },
    {
      id: 'AUD-2026-0037',
      hora: '09:20',
      placa: 'RAA-4A20',
      prefixo: 'BT-06',
      tipo: 'Betoneira 10m³ (4 Eixos)',
      risco: 12,
      status: 'alerta',
      diagnostico: 'Leve resíduo no balão (+110 kg / +0,8%) dentro do desvio tolerado de 2,5%',
      acaoTomada: 'Liberado com registro de tara atualizada'
    }
  ];

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
                Motor KyttoIA 2.5 Flash
              </span>
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Supervisão forense contínua: desvio de tara histórica, lastro oculto de água, excentricidade nas 8 células Toledo e dupla pesagem
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
            <span className="text-stone-500">Tolerância KyttoIA:</span>
            <span className="font-mono font-bold text-stone-800">±{sensitivity}%</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span className="text-emerald-800 font-semibold">Conformidade Metrológica:</span>
            <span className="font-mono font-black text-emerald-700">99.1%</span>
          </div>
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
            <span>Auditar & Decidir no CCO</span>
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

      {/* METROLOGY & 8 LOAD CELLS TOPOLOGY (BAL-01 21 METROS) */}
      <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 gap-2">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 flex items-center gap-2">
              <Scale className="w-4 h-4 text-serrano-600" />
              <span>Matriz de 8 Células de Carga Toledo Digital DLC-10t (21 Metros)</span>
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Supervisão de excentricidade, distribuição de carga por eixo e corte de feixe óptico na plataforma
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-500">Excentricidade:</span>
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              0.8% (Tolerância &lt; 3.0%)
            </span>
          </div>
        </div>

        {/* Visual Platform Schematic with 8 Cells */}
        <div className="bg-stone-900 rounded-xl p-4 text-white">
          <div className="text-[10px] font-mono text-stone-400 uppercase tracking-widest text-center mb-3">
            -- ENTRADA PLATAFORMA (21,00m × 3,20m) --
          </div>

          <div className="grid grid-cols-4 gap-3">
            {/* Pair 1 */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-center text-stone-400 font-bold">PAR 1 · EIXO 1</div>
              <div className="p-2.5 bg-stone-800 rounded-lg border border-stone-700 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400 font-bold">DLC-01 (Esq)</span>
                  <span className="text-emerald-400 font-mono">1.618 kg</span>
                </div>
                <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[16%]" />
                </div>
                <div className="text-[9px] text-stone-500 font-mono">12.04 mV · 10t</div>
              </div>
              <div className="p-2.5 bg-stone-800 rounded-lg border border-stone-700 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400 font-bold">DLC-02 (Dir)</span>
                  <span className="text-emerald-400 font-mono">1.622 kg</span>
                </div>
                <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[16%]" />
                </div>
                <div className="text-[9px] text-stone-500 font-mono">12.06 mV · 10t</div>
              </div>
            </div>

            {/* Pair 2 */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-center text-stone-400 font-bold">PAR 2 · EIXO 2</div>
              <div className="p-2.5 bg-stone-800 rounded-lg border border-stone-700 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400 font-bold">DLC-03 (Esq)</span>
                  <span className="text-emerald-400 font-mono">1.612 kg</span>
                </div>
                <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[16%]" />
                </div>
                <div className="text-[9px] text-stone-500 font-mono">12.01 mV · 10t</div>
              </div>
              <div className="p-2.5 bg-stone-800 rounded-lg border border-stone-700 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400 font-bold">DLC-04 (Dir)</span>
                  <span className="text-emerald-400 font-mono">1.616 kg</span>
                </div>
                <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[16%]" />
                </div>
                <div className="text-[9px] text-stone-500 font-mono">12.03 mV · 10t</div>
              </div>
            </div>

            {/* Pair 3 */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-center text-stone-400 font-bold">PAR 3 · EIXO 3</div>
              <div className="p-2.5 bg-stone-800 rounded-lg border border-stone-700 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400 font-bold">DLC-05 (Esq)</span>
                  <span className="text-emerald-400 font-mono">1.620 kg</span>
                </div>
                <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[16%]" />
                </div>
                <div className="text-[9px] text-stone-500 font-mono">12.05 mV · 10t</div>
              </div>
              <div className="p-2.5 bg-stone-800 rounded-lg border border-stone-700 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400 font-bold">DLC-06 (Dir)</span>
                  <span className="text-emerald-400 font-mono">1.614 kg</span>
                </div>
                <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[16%]" />
                </div>
                <div className="text-[9px] text-stone-500 font-mono">12.02 mV · 10t</div>
              </div>
            </div>

            {/* Pair 4 */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-center text-stone-400 font-bold">PAR 4 · EIXO 4</div>
              <div className="p-2.5 bg-stone-800 rounded-lg border border-stone-700 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400 font-bold">DLC-07 (Esq)</span>
                  <span className="text-emerald-400 font-mono">1.608 kg</span>
                </div>
                <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[16%]" />
                </div>
                <div className="text-[9px] text-stone-500 font-mono">11.98 mV · 10t</div>
              </div>
              <div className="p-2.5 bg-stone-800 rounded-lg border border-stone-700 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-stone-400 font-bold">DLC-08 (Dir)</span>
                  <span className="text-emerald-400 font-mono">1.610 kg</span>
                </div>
                <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[16%]" />
                </div>
                <div className="text-[9px] text-stone-500 font-mono">11.99 mV · 10t</div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-stone-800 flex items-center justify-between text-[10px] text-stone-400 font-mono">
            <span>SOMATÓRIO DIGITAL MODBUS: <strong className="text-emerald-400">{totalCellWeight.toLocaleString('pt-BR')} kg</strong></span>
            <span>STATUS: <strong className="text-emerald-400">8 CÉLULAS EM HOMOGENEIDADE PERFEITA (IPEM-MT APROVADO)</strong></span>
          </div>
        </div>
      </div>

      {/* FORENSIC AUDIT LOG TABLE */}
      <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-800 flex items-center gap-2">
            <History className="w-4 h-4 text-serrano-600" />
            <span>Histórico de Auditorias Forenses Realizadas Hoje</span>
          </h3>
          <span className="text-[10px] text-stone-500">75 pesagens auditadas · 1 incidente ativo</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold text-[10px] uppercase">
                <th className="p-2.5">ID / Hora</th>
                <th className="p-2.5">Veículo / Placa</th>
                <th className="p-2.5">Risco KyttoIA</th>
                <th className="p-2.5">Diagnóstico Forense</th>
                <th className="p-2.5 text-right">Ação Operacional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                  <td className="p-2.5 font-mono text-stone-600">
                    <div className="font-bold text-stone-900">{log.id}</div>
                    <div className="text-[10px] text-stone-400">{log.hora}</div>
                  </td>
                  <td className="p-2.5">
                    <div className="font-bold text-stone-900">{log.prefixo} ({log.placa})</div>
                    <div className="text-[10px] text-stone-500">{log.tipo}</div>
                  </td>
                  <td className="p-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      log.status === 'critico'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : log.status === 'alerta'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      Risco {log.risco}/100
                    </span>
                  </td>
                  <td className="p-2.5 text-stone-700 text-[11px] max-w-xs">
                    {log.diagnostico}
                  </td>
                  <td className="p-2.5 text-right font-semibold text-[11px]">
                    <span className={log.status === 'critico' ? 'text-rose-700 font-bold' : 'text-stone-700'}>
                      {log.acaoTomada}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <p className="text-stone-600 mt-2 text-[11px] leading-relaxed">
                {rule.descricao}
              </p>
              <div className="mt-2.5 pt-2 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-500">
                <span>Tolerância: <strong className="text-stone-800">{rule.tolerancia}</strong></span>
                <span>Ação: <strong className="text-rose-700">{rule.acaoAutomatica}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
