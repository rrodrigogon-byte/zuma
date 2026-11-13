import React, { useState } from 'react';
import { 
  Users, 
  Building2, 
  FileText, 
  Plus, 
  MapPin, 
  CheckCircle2, 
  Beaker, 
  Droplet, 
  Layers, 
  Sparkles,
  Calculator
} from 'lucide-react';
import { CONCRETE_MIXES } from '../data/mockData';

export default function ClientsOrders() {
  const [selectedMix, setSelectedMix] = useState(CONCRETE_MIXES[2]); // TR-FCK30B
  const [calcVolume, setCalcVolume] = useState(8);

  const totalCimentoKg = selectedMix.cimentoPorM3Kg * calcVolume;
  const totalAreiaKg = selectedMix.areiaPorM3Kg * calcVolume;
  const totalBritaKg = selectedMix.britaPorM3Kg * calcVolume;
  const totalAguaL = selectedMix.aguaPorM3L * calcVolume;
  const valorTotal = selectedMix.precoM3 * calcVolume;

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-concrete-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <span>CLIENTES, OBRAS & CATÁLOGO DE TRAÇOS DE CONCRETO</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-serrano-100 text-serrano-800 border border-serrano-200">
              NBR 7212 / NBR 8953
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Gestão técnica de pedidos de concreto dosado em central e canteiros cadastrados em Tangará da Serra
          </p>
        </div>

        <button 
          onClick={() => alert('Formulário de novo cliente aberto!')}
          className="px-3.5 py-2 bg-serrano-500 hover:bg-serrano-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Canteiro</span>
        </button>
      </div>

      {/* Traços NBR & Calculadora de Dosagem */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Concrete Mixes Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-700 flex items-center justify-between">
            <span>Catálogo Oficial de Traços Homologados</span>
            <span className="text-[10px] text-stone-400 font-normal">Controle Tecnológico Laboratório Serrano</span>
          </h3>

          <div className="space-y-3">
            {CONCRETE_MIXES.map(mix => {
              const isSelected = selectedMix.id === mix.id;

              return (
                <div
                  key={mix.id}
                  onClick={() => setSelectedMix(mix)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-white border-serrano-500 shadow-sm ring-2 ring-serrano-100' 
                      : 'bg-white border-concrete-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                          {mix.id}
                        </span>
                        <h4 className="font-bold text-sm text-stone-900">
                          {mix.nome}
                        </h4>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        {mix.aplicacao}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-stone-900 font-mono">
                        R$ {mix.precoM3.toFixed(2).replace('.', ',')}
                        <span className="text-xs font-normal text-stone-500">/m³</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700">Homologado</span>
                    </div>
                  </div>

                  {/* Recipe Metrics */}
                  <div className="mt-3 pt-2.5 border-t border-concrete-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-stone-600">
                    <div>
                      <span className="text-stone-400 block text-[10px]">SLUMP TEST</span>
                      <strong className="text-stone-800 font-mono">{mix.slump}</strong>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">AGREGADO</span>
                      <strong className="text-stone-800">{mix.brita}</strong>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">CIMENTO / M³</span>
                      <strong className="text-stone-800 font-mono">{mix.cimentoPorM3Kg} kg</strong>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">ADITIVO</span>
                      <strong className="text-stone-800 truncate block">{mix.aditivo.split(' ')[0]}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Instant Batch Calculator for Selected Mix (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-stone-700 flex items-center justify-between">
            <span>Simulador de Batelada Central Dosadora</span>
            <span className="text-[10px] text-stone-400 font-normal">Cálculo NBR 7212</span>
          </h3>

          <div className="bg-white p-5 rounded-2xl border border-concrete-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-concrete-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-serrano-700">Traço Selecionado</span>
                <h4 className="text-sm font-black text-stone-900">{selectedMix.id} · {selectedMix.classe}</h4>
              </div>
              <div className="p-2 rounded-xl bg-serrano-50 text-serrano-600">
                <Calculator className="w-5 h-5" />
              </div>
            </div>

            {/* Volume Selector */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Volume da Betoneira (m³ de concreto):
              </label>
              <div className="flex items-center gap-2">
                {[6, 8, 10, 12].map(v => (
                  <button
                    key={v}
                    onClick={() => setCalcVolume(v)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      calcVolume === v 
                        ? 'bg-stone-900 text-white shadow-xs' 
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {v} m³
                  </button>
                ))}
              </div>
            </div>

            {/* Calculated Raw Material Requirements */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Dosagem Automática na Convicta 96t:
              </span>

              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between">
                <span className="text-stone-600 font-medium">Cimento (Silo 01/02):</span>
                <span className="font-mono font-bold text-stone-900">{totalCimentoKg.toLocaleString('pt-BR')} kg</span>
              </div>

              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between">
                <span className="text-stone-600 font-medium">Areia Média Lavada:</span>
                <span className="font-mono font-bold text-stone-900">{totalAreiaKg.toLocaleString('pt-BR')} kg</span>
              </div>

              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between">
                <span className="text-stone-600 font-medium">Brita Combinada (0 e 1):</span>
                <span className="font-mono font-bold text-stone-900">{totalBritaKg.toLocaleString('pt-BR')} kg</span>
              </div>

              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between">
                <span className="text-stone-600 font-medium">Água Potável:</span>
                <span className="font-mono font-bold text-stone-900">{totalAguaL.toLocaleString('pt-BR')} L</span>
              </div>
            </div>

            {/* Total Pricing */}
            <div className="pt-3 border-t border-concrete-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-stone-400 block">VALOR ESTIMADO DA CARGA</span>
                <div className="text-xl font-black text-stone-900 font-mono">
                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <button 
                onClick={() => alert(`Batelada de ${calcVolume}m³ enviada para fila de pesagem e dosagem!`)}
                className="px-3.5 py-2 bg-serrano-500 hover:bg-serrano-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Carregar Carga
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
