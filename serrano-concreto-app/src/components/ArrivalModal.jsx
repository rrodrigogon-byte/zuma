import React, { useState } from 'react';
import { Truck, X, CheckCircle2, ShieldCheck, MapPin, User, Building2, Package, Sparkles } from 'lucide-react';

export default function ArrivalModal({ isOpen, onClose, onRegisterArrival, fleet = [] }) {
  const [tipoVeiculo, setTipoVeiculo] = useState('frota'); // 'frota' | 'terceiro'
  const [selectedPrefixo, setSelectedPrefixo] = useState(fleet[0]?.prefixo || 'BT-05');
  const [placaManual, setPlacaManual] = useState('');
  const [motoristaManual, setMotoristaManual] = useState('');
  const [clienteManual, setClienteManual] = useState('');
  const [produtoManual, setProdutoManual] = useState('Concreto FCK 30 MPa Bombeável');
  const [destino, setDestino] = useState('balanca'); // 'balanca' | 'espera' | 'dosadora'
  const [unidade, setUnidade] = useState('usina'); // 'usina' | 'mineracao'

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    let veiculoData;

    if (tipoVeiculo === 'frota') {
      const v = fleet.find(f => f.prefixo === selectedPrefixo) || fleet[0];
      veiculoData = {
        id: `v-${Date.now()}`,
        placa: v.placa,
        prefixo: v.prefixo,
        tipo: v.tipo,
        chassi: v.modelo,
        motorista: v.motorista,
        localizacao: destino,
        unidade,
        taraKg: v.taraPadraoKg || 12900,
        brutoKg: null,
        liquidoKg: null,
        pedidoId: `PED-${Math.floor(4400 + Math.random() * 100)}`,
        cliente: v.tipo.includes('Caçamba') ? 'ConstruMais Tangará' : 'Construtora Alvorada Ltda',
        obra: v.tipo.includes('Caçamba') ? 'Depósito Central' : 'Residencial Manacá - Laje 4º Pav.',
        traco: v.tipo.includes('Caçamba') ? 'Areia Média Lavada' : 'TR-FCK30B',
        volumeM3: v.tipo.includes('10m³') ? 10.0 : 8.0,
        horaEntrada: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        statusTag: destino === 'balanca' ? 'Na balança' : 'Na fila de espera',
        alerta: null
      };
    } else {
      veiculoData = {
        id: `v-${Date.now()}`,
        placa: (placaManual || 'BRA-2026').toUpperCase(),
        prefixo: 'VISIT-01',
        tipo: 'Caminhão Caçamba Terceiro',
        chassi: 'Mercedes-Benz Atego',
        motorista: motoristaManual || 'Motorista Terceiro',
        localizacao: destino,
        unidade,
        taraKg: 9500,
        brutoKg: null,
        liquidoKg: null,
        pedidoId: `PED-${Math.floor(4400 + Math.random() * 100)}`,
        cliente: clienteManual || 'Cliente Avulso Tangará',
        obra: 'Retirada no Pátio Serrano',
        traco: produtoManual,
        volumeM3: 12.0,
        horaEntrada: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        statusTag: destino === 'balanca' ? 'Na balança' : 'Na fila de espera',
        alerta: null
      };
    }

    onRegisterArrival(veiculoData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-concrete-300 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-serrano-500 flex items-center justify-center text-white font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                <span>REGISTRAR CHEGADA NA PORTARIA</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  OCR / LPR Ativo
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Totem Inteligente &amp; Check-in Kytto Serrano (MT-358)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Tipo de Veículo */}
          <div>
            <label className="font-bold text-stone-700 block mb-1.5">Origem do Veículo:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoVeiculo('frota')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                  tipoVeiculo === 'frota'
                    ? 'bg-serrano-50 border-serrano-500 text-serrano-900 shadow-xs ring-2 ring-serrano-200'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                Frota Própria Serrano
              </button>
              <button
                type="button"
                onClick={() => setTipoVeiculo('terceiro')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                  tipoVeiculo === 'terceiro'
                    ? 'bg-serrano-50 border-serrano-500 text-serrano-900 shadow-xs ring-2 ring-serrano-200'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                Veículo Terceiro / Visitante
              </button>
            </div>
          </div>

          {tipoVeiculo === 'frota' ? (
            <div>
              <label className="font-bold text-stone-700 block mb-1">Selecione o Caminhão da Frota:</label>
              <select
                value={selectedPrefixo}
                onChange={(e) => setSelectedPrefixo(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 font-mono text-stone-800 focus:outline-none focus:border-serrano-500"
              >
                {fleet.map(v => (
                  <option key={v.prefixo} value={v.prefixo}>
                    {v.prefixo} — {v.placa} ({v.tipo} · {v.motorista})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Placa do Veículo (LPR):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: RRA-4A20"
                    value={placaManual}
                    onChange={(e) => setPlacaManual(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 font-mono uppercase focus:outline-none focus:border-serrano-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Nome do Motorista:</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo"
                    value={motoristaManual}
                    onChange={(e) => setMotoristaManual(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Cliente / Destinatário:</label>
                  <input
                    type="text"
                    placeholder="Ex: Construtora Buritis"
                    value={clienteManual}
                    onChange={(e) => setClienteManual(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Produto Previsto:</label>
                  <select
                    value={produtoManual}
                    onChange={(e) => setProdutoManual(e.target.value)}
                    className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500"
                  >
                    <option value="Concreto FCK 30 MPa Bombeável">Concreto FCK 30 MPa Bombeável</option>
                    <option value="Concreto FCK 25 MPa">Concreto FCK 25 MPa</option>
                    <option value="Concreto FCK 35 ARI">Concreto FCK 35 ARI</option>
                    <option value="Areia Média Lavada">Areia Média Lavada (Mineração)</option>
                    <option value="Brita 1 (19mm)">Brita 1 (19mm)</option>
                    <option value="Pedrisco (Brita 0)">Pedrisco (Brita 0)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Destino Inicial & Unidade Operacional */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-100">
            <div>
              <label className="font-bold text-stone-700 block mb-1">Unidade Industrial:</label>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500 font-semibold"
              >
                <option value="usina">Usina de Concreto MT-358</option>
                <option value="mineracao">Mineração de Agregados Rio Sangue</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">Direcionar Para:</label>
              <select
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className="w-full p-2 rounded-xl border border-stone-300 focus:outline-none focus:border-serrano-500 font-semibold"
              >
                <option value="balanca">Balança Rodoviária (1ª Pesagem - Tara)</option>
                <option value="espera">Faixa de Espera / Pátio</option>
                <option value="dosadora">Direto para Central Dosadora Convicta</option>
              </select>
            </div>
          </div>

          {/* AI Banner */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-[11px] text-emerald-900 leading-tight">
              <strong>Auditoria KyttoIA 2.5:</strong> Ao registrar, as 4 câmeras LPR capturam a placa dianteira e traseira e cruzam com o histórico de tara e CNPJ da obra.
            </span>
          </div>

          {/* Footer Actions */}
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
              className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold shadow-md transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Confirmar Entrada na Usina</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
