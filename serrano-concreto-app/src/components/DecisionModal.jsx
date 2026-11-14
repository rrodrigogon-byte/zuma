import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Truck, 
  Scale, 
  FileEdit,
  ArrowRight
} from 'lucide-react';

export default function DecisionModal({ exceptionData, onClose, onResolve }) {
  const [justificativa, setJustificativa] = useState('Tanque auxiliar de água para lavagem de balão cheio na saída da garagem.');
  const [selectedAction, setSelectedAction] = useState('aprovar');

  if (!exceptionData) return null;

  const handleConfirm = () => {
    onResolve(selectedAction, justificativa);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-stone-200">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600 text-white">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                AUDITORIA DE SEGURANÇA · MOTOR KYTTOIA
              </span>
              <h3 className="text-sm font-extrabold text-stone-900">
                Decisão Operacional: {exceptionData.veiculoPlaca || 'NJK-3307'}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic Card */}
        <div className="my-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2">
          <div className="font-extrabold text-rose-950">
            {exceptionData.titulo || 'Tara fora do padrão detectada'}
          </div>
          <p className="text-rose-900 leading-relaxed text-[11px]">
            {exceptionData.detalhes || 'A tara pesada de 10.190 kg excede em +6,1% a média histórica móvel (9.600 kg). Há forte indício de lastro oculto de água adicionado antes da pesagem de entrada para aumentar o peso descontado da carga.'}
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
            <div className="bg-white p-2 rounded-lg border border-rose-200 text-center">
              <span className="text-[10px] text-stone-400 block font-sans">TARA PESADA</span>
              <strong className="text-rose-700">10.190 kg</strong>
            </div>
            <div className="bg-white p-2 rounded-lg border border-rose-200 text-center">
              <span className="text-[10px] text-stone-400 block font-sans">TARA MÉDIA</span>
              <strong className="text-stone-800">9.600 kg</strong>
            </div>
            <div className="bg-white p-2 rounded-lg border border-rose-200 text-center">
              <span className="text-[10px] text-stone-400 block font-sans">DESVIO DETECTADO</span>
              <strong className="text-rose-700">+590 kg (+6.1%)</strong>
            </div>
          </div>
        </div>

        {/* Action Options */}
        <div className="space-y-2 text-xs">
          <label className="font-bold text-stone-800 block">
            Selecione a Ação Corretiva da Torre:
          </label>

          <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
            selectedAction === 'aprovar' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-100' : 'bg-stone-50 border-stone-200'
          }`}>
            <input 
              type="radio" 
              name="action" 
              checked={selectedAction === 'aprovar'} 
              onChange={() => setSelectedAction('aprovar')}
              className="mt-0.5 text-serrano-600 focus:ring-serrano-500" 
            />
            <div>
              <span className="font-bold text-stone-900 block">1. Liberar com Justificativa Técnica</span>
              <span className="text-[11px] text-stone-500">
                Aceita a tara mediante registro de motivo operacional no log de auditoria da KyttoIA.
              </span>
            </div>
          </label>

          <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
            selectedAction === 'excecao' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-100' : 'bg-stone-50 border-stone-200'
          }`}>
            <input 
              type="radio" 
              name="action" 
              checked={selectedAction === 'excecao'} 
              onChange={() => setSelectedAction('excecao')}
              className="mt-0.5 text-serrano-600 focus:ring-serrano-500" 
            />
            <div>
              <span className="font-bold text-stone-900 block">2. Manter na Baia de Exceção para Inspeção Física</span>
              <span className="text-[11px] text-stone-500">
                Cancela bloqueada. O fiscal de pátio verificará manualmente os tanques de combustível e água.
              </span>
            </div>
          </label>

          <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
            selectedAction === 'repesar' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100' : 'bg-stone-50 border-stone-200'
          }`}>
            <input 
              type="radio" 
              name="action" 
              checked={selectedAction === 'repesar'} 
              onChange={() => setSelectedAction('repesar')}
              className="mt-0.5 text-serrano-600 focus:ring-serrano-500" 
            />
            <div>
              <span className="font-bold text-stone-900 block">3. Exigir Repesagem com Operador Presencial</span>
              <span className="text-[11px] text-stone-500">
                Instrui o motorista via interfone a manobrar novamente e posicionar os eixos na BAL-01.
              </span>
            </div>
          </label>
        </div>

        {/* Justification Text Area if approving */}
        {selectedAction === 'aprovar' && (
          <div className="mt-3">
            <label className="text-[11px] font-bold text-stone-700 block mb-1">
              Justificativa do Operador (obrigatório para auditoria):
            </label>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={2}
              className="w-full p-2.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:border-serrano-500"
            />
          </div>
        )}

        {/* Modal Footer Buttons */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>Confirmar Decisão</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>

      </div>
    </div>
  );
}
