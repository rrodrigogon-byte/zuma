import React, { useState } from 'react';
import { 
  X, 
  Truck, 
  Scale, 
  Layers, 
  Droplets, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  Cpu, 
  Wind, 
  FileText, 
  Send, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Gauge, 
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Leaf
} from 'lucide-react';

export default function SuperAutonomiaModal({ isOpen, onClose, initialTab = 'trackit' }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [resultadoAcao, setResultadoAcao] = useState(null);

  // Estados locais para simulações
  const [minutosEsperaCanteiro, setMinutosEsperaCanteiro] = useState(48);
  const [sensorAguaL, setSensorAguaL] = useState(0);
  const [ventoKmh, setVentoKmh] = useState(26.4);
  const [fckProjeto, setFckProjeto] = useState(30);

  // Execuções em tempo real via API
  const executarSimulacao = async (tipo) => {
    try {
      setLoading(true);
      setResultadoAcao(null);

      if (tipo === 'trackit') {
        const res = await fetch('/api/admin/concreto/transporte/ciclo-geofence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caminhaoId: 'BT-05 (QBF-6M02)',
            distanciaCanteiroM: 65,
            rpmTambor: 2.8,
            sentidoRotacao: 'agitacao',
            minutosDesdeCarregamento: 52,
            minutosEmCanteiro: minutosEsperaCanteiro,
            sensorVazaoAguaL: sensorAguaL,
            franquiaEsperaMin: 30,
            valorHoraDemurrage: 180.00
          })
        }).then(r => r.json());
        setResultadoAcao(res);
      } else if (tipo === 'estatistica') {
        const res = await fetch('/api/admin/concreto/laboratorio/aceitacao-estatistica-nbr12655', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loteId: 'LOTE-PILAR-T1-HORIZON',
            fckProjetoMPa: fckProjeto,
            idadeDias: 28,
            tipoControle: 'amostragem_parcial',
            amostrasRupturaMPa: [33.8, 35.4, 32.2, 34.9, 36.5, 33.1],
            elementoEstrutural: 'Pilares e Vigas de Sustentação Principal'
          })
        }).then(r => r.json());
        setResultadoAcao(res);
      } else if (tipo === 'silos') {
        const res = await fetch('/api/admin/concreto/silos/ressuprimento-autonomo').then(r => r.json());
        setResultadoAcao(res);
      } else if (tipo === 'bomba') {
        const res = await fetch('/api/admin/concreto/bombas/auditar-desgaste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bombaId: 'BOMBA-01 (Schwing S36X)',
            volumeBombeadoHojeM3: 92.0,
            pressaoHidraulicaBar: 185,
            velocidadeVentoKmh: ventoKmh,
            m3AcumuladosTubulacao: 18600
          })
        }).then(r => r.json());
        setResultadoAcao(res);
      } else if (tipo === 'esg') {
        const res = await fetch('/api/admin/concreto/sustentabilidade/balanco-carbono-esg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            volumeM3: 64.0,
            traçoFck: 30
          })
        }).then(r => r.json());
        setResultadoAcao(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#121519] border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col text-stone-100 shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* CABEÇALHO */}
        <div className="p-5 border-b border-stone-800 flex items-center justify-between bg-[#161A1F]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-serrano-500/20 border border-serrano-500/40 flex items-center justify-center text-serrano-400">
              <Sparkles className="w-5 h-5 text-serrano-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold uppercase tracking-wide text-white">
                  CENTRAL DE AUTONOMIA MÁXIMA &amp; SUPERAÇÃO DE MERCADO
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  MOTOR KYTTOIA 2.5 FLASH
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                5 Motores Autônomos de Engenharia NBR e Telemetria CCO Superando Command Alkon, Marcotte e Sysdyne
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVEGAÇÃO ENTRE OS 5 MOTORES */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-800 bg-[#0E1013] overflow-x-auto">
          {[
            { id: 'trackit', label: '1. Virtual TrackIt (NBR 7212)', icon: Truck, desc: 'Geofence & Demurrage' },
            { id: 'estatistica', label: '2. Aceitação Estatística (NBR 12655)', icon: Scale, desc: 'Cálculo de fck,est' },
            { id: 'silos', label: '3. Silos Preditivos (80 GHz)', icon: Layers, desc: 'Ressuprimento PO Auto' },
            { id: 'bomba', label: '4. Bomba Lança 36m (NBR 15649)', icon: Gauge, desc: 'Vento & Fadiga de Tubos' },
            { id: 'esg', label: '5. Balanço ESG & Reciclador', icon: Leaf, desc: 'Pegada CO2e & Rio Sepotuba' },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setResultadoAcao(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  active 
                    ? 'bg-serrano-500 text-stone-950 shadow-md font-extrabold' 
                    : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO PRINCIPAL DO MOTOR SELECIONADO */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* TAB 1: TRACKIT GEOFENCING NBR 7212 */}
          {activeTab === 'trackit' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Caminhão &amp; Obra</div>
                  <div className="text-sm font-extrabold text-white mt-1">BT-05 · Betoneira 10m³</div>
                  <div className="text-xs text-stone-400">Residencial Ilhas do Lago (MT-358)</div>
                  <div className="mt-2 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Dentro do Raio Geofence (65m)
                  </div>
                </div>

                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tempo de Espera no Canteiro</div>
                  <div className="text-lg font-black text-amber-400 font-mono mt-1">{minutosEsperaCanteiro} min</div>
                  <div className="text-[11px] text-stone-400">Franquia contratual: 30 min livres</div>
                  <input 
                    type="range" 
                    min="10" 
                    max="120" 
                    value={minutosEsperaCanteiro} 
                    onChange={e => setMinutosEsperaCanteiro(Number(e.target.value))}
                    className="w-full mt-2 accent-serrano-500"
                  />
                </div>

                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Lacre &amp; Injeção Clandestina</div>
                  <div className="text-lg font-black font-mono mt-1 text-white">{sensorAguaL} L</div>
                  <div className="text-[11px] text-stone-400">Hidrômetro eletrônico do tambor</div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => setSensorAguaL(0)}
                      className={`text-[10px] px-2 py-1 rounded font-bold ${sensorAguaL === 0 ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-300'}`}
                    >
                      0L (Intacto)
                    </button>
                    <button 
                      onClick={() => setSensorAguaL(35)}
                      className={`text-[10px] px-2 py-1 rounded font-bold ${sensorAguaL > 0 ? 'bg-rose-600 text-white' : 'bg-stone-800 text-stone-300'}`}
                    >
                      +35L (Violação)
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => executarSimulacao('trackit')}
                  disabled={loading}
                  className="px-5 py-2.5 bg-gradient-to-r from-serrano-500 to-amber-500 text-stone-950 font-black rounded-xl text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Auditar Ciclo Geofence em Tempo Real
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ESTATÍSTICA NBR 12655 */}
          {activeTab === 'estatistica' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Lote Estrutural</div>
                  <div className="text-sm font-extrabold text-white mt-1">LOTE-PILAR-T1</div>
                  <div className="text-xs text-stone-400">Pilares Térreo · 64 m³ concretados</div>
                  <div className="text-[11px] text-stone-400 mt-2 font-mono">6 Amostras cilíndricas 10x20cm</div>
                </div>

                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">fck de Projeto</div>
                  <div className="text-lg font-black text-white font-mono mt-1">{fckProjeto} MPa</div>
                  <div className="flex gap-2 mt-2">
                    {[25, 30, 35, 40].map(f => (
                      <button
                        key={f}
                        onClick={() => setFckProjeto(f)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold ${fckProjeto === f ? 'bg-serrano-500 text-stone-950 font-black' : 'bg-stone-800 text-stone-400'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Rupturas na Prensa (MPa)</div>
                  <div className="text-xs font-mono text-emerald-400 mt-2 tracking-wide font-bold">
                    33.8 · 35.4 · 32.2 · 34.9 · 36.5 · 33.1
                  </div>
                  <div className="text-[10px] text-stone-400 mt-2">Média da amostra: 34.3 MPa</div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => executarSimulacao('estatistica')}
                  disabled={loading}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-black rounded-xl text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Calcular Aceitação Estrutural NBR 12655
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SILOS PREDITIVOS */}
          {activeTab === 'silos' && (
            <div className="space-y-4">
              <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold uppercase text-white">Telemetria de Silos &amp; Radares 80 GHz</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">Usina Matriz MT-358 · Tangará da Serra/MT</div>
                  </div>
                  <button
                    onClick={() => executarSimulacao('silos')}
                    disabled={loading}
                    className="px-4 py-2 bg-serrano-500 text-stone-950 font-black rounded-xl text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-md"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Auditar Níveis e Autonomia
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BOMBA LANÇA 36M */}
          {activeTab === 'bomba' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Equipamento</div>
                  <div className="text-sm font-extrabold text-white mt-1">BOMBA-01 · Schwing S36X</div>
                  <div className="text-xs text-stone-400">Lança 36m telescópica 4 seções</div>
                  <div className="text-[11px] text-stone-400 mt-2 font-mono">Pressão Nominal: 185 bar</div>
                </div>

                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Anemômetro Ponta da Lança</div>
                  <div className="text-lg font-black font-mono mt-1 text-white">{ventoKmh} km/h</div>
                  <div className="text-[11px] text-stone-400">Limite de segurança NBR 15649: 48 km/h</div>
                  <input 
                    type="range" 
                    min="10" 
                    max="65" 
                    value={ventoKmh} 
                    onChange={e => setVentoKmh(Number(e.target.value))}
                    className="w-full mt-2 accent-serrano-500"
                  />
                </div>

                <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tubulação 5" Abrasão</div>
                  <div className="text-lg font-black font-mono mt-1 text-emerald-400">18.600 / 25.000 m³</div>
                  <div className="text-[11px] text-stone-400">Vida útil restante: 25.6%</div>
                  <div className="text-[10px] text-amber-400 mt-1">Areia Sepotuba alto teor de quartzo</div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => executarSimulacao('bomba')}
                  disabled={loading}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black rounded-xl text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Auditar Segurança e Desgaste da Bomba
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: ESG & RECICLADOR */}
          {activeTab === 'esg' && (
            <div className="space-y-4">
              <div className="p-4 bg-stone-900/60 rounded-xl border border-stone-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold uppercase text-white">Balanço de Carbono &amp; Reciclador Ecológico</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">Norma ABNT NBR ISO 14064 · Preservação do Rio Sepotuba</div>
                </div>
                <button
                  onClick={() => executarSimulacao('esg')}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all flex items-center gap-2 shadow-md"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Calcular Pegada e Créditos ESG
                </button>
              </div>
            </div>
          )}

          {/* PAINEL DE RESULTADO DA AÇÃO (JSON FORMATADO EM CARDS ELEGANTES) */}
          {resultadoAcao && (
            <div className="p-5 bg-stone-950/80 rounded-xl border border-stone-800 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-serrano-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Telemetria &amp; Parecer do Motor KyttoIA
                </span>
                <span className="text-[10px] font-mono text-stone-500">Status: OK 200</span>
              </div>

              {/* Detalhes específicos de cada tela */}
              {activeTab === 'trackit' && resultadoAcao.geofence && (
                <div className="space-y-2">
                  <div className="p-3 bg-stone-900 rounded-lg text-xs leading-relaxed text-stone-200 border-l-4 border-serrano-500">
                    {resultadoAcao.recomendacaoMotorKyttoIA}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Estágio Atual</span>
                      <strong className="text-white font-mono">{resultadoAcao.estagioAtual}</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Tempo Carregamento</span>
                      <strong className="text-white font-mono">{resultadoAcao.conformidadeNBR7212.minutosDesdeCarregamento} min / 90 min</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Estadia Excedente</span>
                      <strong className="text-amber-400 font-mono">{resultadoAcao.geofence.minutosEstadiaExcedente} min</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Demurrage Faturado</span>
                      <strong className="text-emerald-400 font-mono">R$ {resultadoAcao.geofence.valorDemurrageGerado?.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'estatistica' && resultadoAcao.decisaoNormativa && (
                <div className="space-y-2">
                  <div className={`p-3 rounded-lg text-xs leading-relaxed border-l-4 ${resultadoAcao.decisaoNormativa.aprovado ? 'bg-emerald-950/40 text-emerald-200 border-emerald-500' : 'bg-rose-950/40 text-rose-200 border-rose-500'}`}>
                    {resultadoAcao.decisaoNormativa.parecerTecnico}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">fck Projeto</span>
                      <strong className="text-white font-mono">{resultadoAcao.fckProjetoMPa} MPa</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">fck,est Calculado</span>
                      <strong className="text-emerald-400 font-mono">{resultadoAcao.estatisticas.resistenciaCaracteristicaEstimadaFckEst} MPa</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Margem Segurança</span>
                      <strong className="text-amber-400 font-mono">{resultadoAcao.decisaoNormativa.margemSegurancaPercent}</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Certificado Autenticado</span>
                      <strong className="text-stone-300 font-mono text-[10px]">{resultadoAcao.certificadoAutenticidade}</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'silos' && resultadoAcao.silos && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {resultadoAcao.silos.map(s => (
                    <div key={s.id} className="p-3 bg-stone-900/80 rounded-lg border border-stone-800 space-y-1">
                      <div className="text-[11px] font-bold text-white">{s.nome.split('·')[1]}</div>
                      <div className="text-lg font-black text-amber-400 font-mono">{(s.nivelAtualKg / 1000).toFixed(1)} t <span className="text-[10px] text-stone-400">({s.percentualOcupacao}%)</span></div>
                      <div className="text-[10px] text-stone-400">Autonomia: <span className="font-bold text-white">{s.autonomiaHoras}h</span></div>
                      {s.ordemCompraDisparada ? (
                        <div className="mt-2 text-[10px] p-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          🚨 {s.ordemCompraDisparada.numeroPO} (35t solicitadas automaticamente)
                        </div>
                      ) : (
                        <div className="mt-2 text-[10px] p-1.5 rounded bg-emerald-500/20 text-emerald-300">
                          ✅ Estoque dentro da faixa segura
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'bomba' && resultadoAcao.telemetriaAoVivo && (
                <div className="space-y-2">
                  <div className={`p-3 rounded-lg text-xs leading-relaxed border-l-4 ${resultadoAcao.telemetriaAoVivo.bloqueioLancaPorSeguranca ? 'bg-rose-950/40 text-rose-200 border-rose-500' : 'bg-emerald-950/40 text-emerald-200 border-emerald-500'}`}>
                    {resultadoAcao.alertaSeguranca}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Velocidade do Vento</span>
                      <strong className={`font-mono ${resultadoAcao.telemetriaAoVivo.bloqueioLancaPorSeguranca ? 'text-rose-400 font-black' : 'text-white'}`}>{resultadoAcao.telemetriaAoVivo.velocidadeVentoKmh} km/h</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Pressão Hidráulica</span>
                      <strong className="text-white font-mono">{resultadoAcao.telemetriaAoVivo.pressaoHidraulicaBar} bar</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Vida Útil Tubulação</span>
                      <strong className="text-amber-400 font-mono">{resultadoAcao.auditoriaDesgasteTubulacaoNBR15649.percentualVidaUtilRestante}</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Troca Preventiva em</span>
                      <strong className="text-emerald-400 font-mono">{resultadoAcao.auditoriaDesgasteTubulacaoNBR15649.m3RestantesAteTroca} m³</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'esg' && resultadoAcao.pegadaCarbonoGEE && (
                <div className="space-y-2">
                  <div className="p-3 bg-emerald-950/30 text-emerald-200 border-l-4 border-emerald-500 rounded-lg text-xs">
                    🌿 Certificado ESG emitido com sucesso: <span className="font-mono font-bold text-white">{resultadoAcao.certificadoESGVerde}</span>. Pegada unitária de {resultadoAcao.pegadaCarbonoGEE.pegadaUnitariaKgCO2ePorM3} kg CO₂e/m³.
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Volume Analisado</span>
                      <strong className="text-white font-mono">{resultadoAcao.volumeTotalM3} m³</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Água Preservada</span>
                      <strong className="text-teal-400 font-mono">{resultadoAcao.recicladorSustentabilidadeRioSepotuba.aguaPreservadaLençolL} L</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Efluente em Solo</span>
                      <strong className="text-emerald-400 font-mono">0 Litros (Zero)</strong>
                    </div>
                    <div className="p-2.5 bg-stone-900/60 rounded-lg">
                      <span className="text-stone-400 text-[10px] block">Circularidade</span>
                      <strong className="text-emerald-400 font-mono">{resultadoAcao.recicladorSustentabilidadeRioSepotuba.indiceEconomiaCircularPercent}</strong>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* RODAPÉ */}
        <div className="p-4 border-t border-stone-800 bg-[#161A1F] flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Engenharia de Concreto ABNT &amp; CCO Autônomo · Usina Serrano MT-358</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Fechar Painel
          </button>
        </div>

      </div>
    </div>
  );
}
