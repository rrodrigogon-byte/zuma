import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, Scale, Eye, FileText, CheckCircle2 } from 'lucide-react';

export default function AnomalyModal({ isOpen, onClose, onInjectAnomaly, vehicles = [] }) {
  const [anomalyType, setAnomalyType] = useState('tara_desvio');
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || 'v1');
  const [customMsg, setCustomMsg] = useState('');

  if (!isOpen) return null;

  const ANOMALY_PRESETS = [
    {
      id: 'tara_desvio',
      title: 'Desvio de Tara Histórica (+6,1% / +590 kg)',
      desc: 'Veículo com tara muito superior à média cadastrada. Risco iminente de lastro oculto de água para fraude de peso líquido.',
      severidade: 'critico'
    },
    {
      id: 'roda_fora',
      title: 'Mau Posicionamento: Eixo Traseiro Fora da Célula de Carga',
      desc: 'Câmera 04 de sensores ópticos acusa que o 4º eixo está tocando a rampa de transição fora das células digitais Toledo DLC-10t.',
      severidade: 'alerta'
    },
    {
      id: 'dupla_pesagem',
      title: 'Dupla Pesagem Consecutiva em Curto Intervalo (< 2 min)',
      desc: 'Tentativa de registro de nova pesagem para a mesma placa antes de concluir o ciclo de carregamento e expedição.',
      severidade: 'critico'
    },
    {
      id: 'divergencia_lpr',
      title: 'Divergência de Placa LPR vs Manifesto Fiscal',
      desc: 'Câmera LPR dianteira leu caracteres divergentes da placa vinculada à Ordem de Concretagem NBR 7212.',
      severidade: 'alerta'
    }
  ];

  const handleConfirm = (e) => {
    e.preventDefault();
    const preset = ANOMALY_PRESETS.find(p => p.id === anomalyType) || ANOMALY_PRESETS[0];
    const veiculo = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0] || {
      placa: 'NJK-3307',
      prefixo: 'CC-03'
    };

    const anomalyEvent = {
      id: `evt-anomalia-${Date.now()}`,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      tipo: 'ia_alerta',
      categoria: 'KyttoIA',
      titulo: `KyttoIA Alerta Forense: ${preset.title.split(':')[0]} · ${veiculo.placa}`,
      detalhes: customMsg || `${preset.desc} Veículo: ${veiculo.prefixo || veiculo.placa}. Auditoria Motor KyttoIA 2.5 Flash.`,
      severidade: preset.severidade,
      unidade: veiculo.unidade || 'usina',
      acao: {
        rotulo: 'Decidir',
        veiculoPlaca: veiculo.placa,
        excecaoTipo: anomalyType,
        presetInfo: preset
      }
    };

    onInjectAnomaly(anomalyEvent, veiculo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-rose-300 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-rose-950 text-white flex items-center justify-between border-b border-rose-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center text-white font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                <span>SIMULADOR FORENSE DE ANOMALIAS</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono">
                  Motor KyttoIA 2.5
                </span>
              </h3>
              <p className="text-[11px] text-rose-300/80">
                Teste de estresse de auditoria, bloqueio de cancela e resolução CCO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-rose-400 hover:text-white hover:bg-rose-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4 text-xs">
          {/* Preset Selection */}
          <div>
            <label className="font-bold text-stone-800 block mb-2">
              Selecione o Padrão de Fraude / Anomalia a Disparar:
            </label>
            <div className="space-y-2">
              {ANOMALY_PRESETS.map(preset => (
                <label
                  key={preset.id}
                  className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    anomalyType === preset.id
                      ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-100 shadow-xs'
                      : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="anomalyType"
                    checked={anomalyType === preset.id}
                    onChange={() => setAnomalyType(preset.id)}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-bold text-stone-900 block">{preset.title}</span>
                    <span className="text-[11px] text-stone-500 leading-relaxed block mt-0.5">
                      {preset.desc}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Target Vehicle */}
          <div>
            <label className="font-bold text-stone-800 block mb-1">
              Veículo Alvo da Usina / Pátio:
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-stone-300 font-mono text-stone-800 focus:outline-none focus:border-rose-500"
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.prefixo || v.placa} — {v.placa} ({v.tipo} · {v.localizacao})
                </option>
              ))}
            </select>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-200" />
              <span>Injetar Alerta na Torre CCO</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
