import React, { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';

export default function AgroERP() {
  const [aba, setAba] = useState('balanca');
  const [tickets, setTickets] = useState([]);
  const [romaneios, setRomaneios] = useState([]);
  const [safras, setSafras] = useState([]);
  const [silos, setSilos] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [modalBalanca, setModalBalanca] = useState(false);
  const [modalRomaneio, setModalRomaneio] = useState(false);
  const [modalSafra, setModalSafra] = useState(false);
  const [ticketSelecionado, setTicketSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formBalanca, setFormBalanca] = useState({
    placa_veiculo: '', motorista: '', produto_id: '', tipo_operacao: 'entrada', peso_entrada_kg: ''
  });
  const [formSaida, setFormSaida] = useState({ peso_saida_kg: '', umidade_percentual: '', impureza_percentual: '' });
  const [formRomaneio, setFormRomaneio] = useState({
    tipo: 'compra', placa_veiculo: '', motorista: '', produto_id: '',
    peso_bruto_kg: '', peso_tara_kg: '', umidade_percentual: '', impureza_percentual: '',
    valor_unitario: '', observacoes: ''
  });

  useEffect(() => { carregarDados(); }, [aba]);

  async function carregarDados() {
    setLoading(true);
    try {
      if (aba === 'balanca') {
        const r = await fetch(`${API}/agro/tickets`);
        if (r.ok) setTickets((await r.json()).rows || []);
      } else if (aba === 'romaneio') {
        const r = await fetch(`${API}/agro/romaneios`);
        if (r.ok) setRomaneios((await r.json()).rows || []);
      } else if (aba === 'safras') {
        const r = await fetch(`${API}/agro/safras`);
        if (r.ok) setSafras((await r.json()).rows || []);
      } else if (aba === 'silos') {
        const r = await fetch(`${API}/agro/silos`);
        if (r.ok) setSilos((await r.json()).rows || []);
      } else if (aba === 'dashboard') {
        const r = await fetch(`${API}/agro/dashboard`);
        if (r.ok) setDashboard(await r.json());
      }
    } finally { setLoading(false); }
  }

  async function abrirTicket() {
    const r = await fetch(`${API}/agro/tickets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formBalanca) });
    if (r.ok) { setModalBalanca(false); carregarDados(); }
  }

  async function registrarSaida() {
    const r = await fetch(`${API}/agro/tickets/${ticketSelecionado.id}/saida`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formSaida)
    });
    if (r.ok) { setTicketSelecionado(null); carregarDados(); }
  }

  async function criarRomaneio() {
    const peso_tara = Number(formRomaneio.peso_tara_kg);
    const peso_bruto = Number(formRomaneio.peso_bruto_kg);
    const peso_liquido = Math.abs(peso_bruto - peso_tara);
    const umidade = Number(formRomaneio.umidade_percentual) || 0;
    const impureza = Number(formRomaneio.impureza_percentual) || 0;
    const peso_descontado = peso_liquido * (1 - Math.max(0, (umidade - 13)) / 100 - impureza / 100);
    const sacas = peso_descontado / 60;
    const valor_total = sacas * Number(formRomaneio.valor_unitario || 0);

    const r = await fetch(`${API}/agro/romaneios`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formRomaneio, peso_liquido_kg: peso_liquido, sacas, valor_total })
    });
    if (r.ok) { setModalRomaneio(false); carregarDados(); }
  }

  const statusBadge = (status) => {
    const cores = { aguardando_saida: 'bg-yellow-100 text-yellow-800', finalizado: 'bg-green-100 text-green-800', emitido: 'bg-blue-100 text-blue-800', cancelado: 'bg-red-100 text-red-800' };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-700'}`}>{status?.replace('_', ' ')}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🌾 Módulo Agro</h1>
          <p className="text-gray-500 text-sm">Balança rodoviária, romaneios, safras e silos</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'dashboard', label: '📊 Dashboard' },
          { id: 'balanca', label: '⚖️ Balança' },
          { id: 'romaneio', label: '📋 Romaneios' },
          { id: 'safras', label: '🌱 Safras & Talhões' },
          { id: 'silos', label: '🏗️ Silos' },
          { id: 'notas', label: '📄 Nota Produtor' },
        ].map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${aba === a.id ? 'bg-white shadow text-green-700' : 'text-gray-600 hover:text-gray-900'}`}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {aba === 'dashboard' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Tickets (30 dias)</p>
              <p className="text-2xl font-bold text-green-700">{dashboard.balanca_30_dias?.total || 0}</p>
              <p className="text-xs text-yellow-600">{dashboard.balanca_30_dias?.aguardando || 0} aguardando saída</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Peso Total (30 dias)</p>
              <p className="text-2xl font-bold text-green-700">{Number(dashboard.balanca_30_dias?.peso_total_kg || 0).toLocaleString('pt-BR')} kg</p>
              <p className="text-xs text-gray-500">{Number(dashboard.balanca_30_dias?.sacas_total || 0).toLocaleString('pt-BR')} sacas</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Romaneios (30 dias)</p>
              <p className="text-2xl font-bold text-green-700">{dashboard.romaneios_30_dias?.total || 0}</p>
              <p className="text-xs text-gray-500">R$ {Number(dashboard.romaneios_30_dias?.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Silos</p>
              <p className="text-2xl font-bold text-green-700">{dashboard.silos?.length || 0}</p>
              <p className="text-xs text-gray-500">unidades cadastradas</p>
            </div>
          </div>

          {/* Ocupação dos silos */}
          {dashboard.silos?.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Ocupação dos Silos</h3>
              <div className="space-y-3">
                {dashboard.silos.map(silo => {
                  const pct = silo.capacidade_kg ? Math.min(100, (silo.ocupacao_kg / silo.capacidade_kg) * 100) : 0;
                  return (
                    <div key={silo.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{silo.nome}</span>
                        <span className="text-gray-500">{Number(silo.ocupacao_kg).toLocaleString('pt-BR')} / {Number(silo.capacidade_kg).toLocaleString('pt-BR')} kg ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Balança */}
      {aba === 'balanca' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Tickets de Balança</h2>
            <button onClick={() => setModalBalanca(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">+ Novo Ticket</button>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Ticket</th>
                  <th className="text-left p-3 font-medium text-gray-600">Placa</th>
                  <th className="text-left p-3 font-medium text-gray-600">Motorista</th>
                  <th className="text-right p-3 font-medium text-gray-600">Entrada (kg)</th>
                  <th className="text-right p-3 font-medium text-gray-600">Líquido (kg)</th>
                  <th className="text-right p-3 font-medium text-gray-600">Sacas</th>
                  <th className="text-center p-3 font-medium text-gray-600">Status</th>
                  <th className="text-center p-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-green-700">#{t.numero_ticket}</td>
                    <td className="p-3 font-mono">{t.placa_veiculo}</td>
                    <td className="p-3">{t.motorista}</td>
                    <td className="p-3 text-right">{Number(t.peso_entrada_kg || 0).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right font-medium">{t.peso_liquido_kg ? Number(t.peso_liquido_kg).toLocaleString('pt-BR') : '-'}</td>
                    <td className="p-3 text-right">{t.sacas ? Number(t.sacas).toFixed(2) : '-'}</td>
                    <td className="p-3 text-center">{statusBadge(t.status)}</td>
                    <td className="p-3 text-center">
                      {t.status === 'aguardando_saida' && (
                        <button onClick={() => { setTicketSelecionado(t); setFormSaida({ peso_saida_kg: '', umidade_percentual: '', impureza_percentual: '' }); }}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">
                          Registrar Saída
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum ticket encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Romaneios */}
      {aba === 'romaneio' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Romaneios de Carga</h2>
            <button onClick={() => setModalRomaneio(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">+ Novo Romaneio</button>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Número</th>
                  <th className="text-left p-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left p-3 font-medium text-gray-600">Produto</th>
                  <th className="text-left p-3 font-medium text-gray-600">Placa</th>
                  <th className="text-right p-3 font-medium text-gray-600">Peso Líq. (kg)</th>
                  <th className="text-right p-3 font-medium text-gray-600">Sacas</th>
                  <th className="text-right p-3 font-medium text-gray-600">Valor Total</th>
                  <th className="text-center p-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {romaneios.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-green-700">{r.numero}</td>
                    <td className="p-3 capitalize">{r.tipo}</td>
                    <td className="p-3">{r.produto_nome}</td>
                    <td className="p-3 font-mono">{r.placa_veiculo}</td>
                    <td className="p-3 text-right">{Number(r.peso_liquido_kg || 0).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right">{Number(r.sacas || 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-medium">R$ {Number(r.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-center">{statusBadge(r.status)}</td>
                  </tr>
                ))}
                {romaneios.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum romaneio encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Safras */}
      {aba === 'safras' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Safras e Talhões</h2>
            <button onClick={() => setModalSafra(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">+ Nova Safra</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {safras.map(s => (
              <div key={s.id} className="bg-white rounded-xl border p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-800">{s.nome}</h3>
                  {statusBadge(s.status)}
                </div>
                <p className="text-sm text-gray-600">🌾 {s.cultura}</p>
                <p className="text-sm text-gray-600">📅 {s.ano_inicio}/{s.ano_fim}</p>
                <p className="text-sm text-gray-600">📐 {Number(s.area_total_ha || 0).toFixed(2)} ha</p>
                <p className="text-sm text-gray-600">🗺️ {s.qtd_talhoes || 0} talhões</p>
              </div>
            ))}
            {safras.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400">Nenhuma safra cadastrada</div>
            )}
          </div>
        </div>
      )}

      {/* Silos */}
      {aba === 'silos' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Controle de Silos</h2>
          <div className="grid grid-cols-3 gap-4">
            {silos.map(s => {
              const pct = s.capacidade_kg ? Math.min(100, (s.ocupacao_kg / s.capacidade_kg) * 100) : 0;
              return (
                <div key={s.id} className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">🏗️ {s.nome}</h3>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                    <div className={`h-4 rounded-full flex items-center justify-center text-xs text-white font-medium ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.max(pct, 5)}%` }}>
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{Number(s.ocupacao_kg || 0).toLocaleString('pt-BR')} kg ocupados</p>
                  <p className="text-sm text-gray-500">Cap: {Number(s.capacidade_kg || 0).toLocaleString('pt-BR')} kg</p>
                </div>
              );
            })}
            {silos.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400">Nenhum silo cadastrado</div>
            )}
          </div>
        </div>
      )}

      {/* Modal Novo Ticket Balança */}
      {modalBalanca && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">⚖️ Novo Ticket de Balança</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Placa do Veículo</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm uppercase" placeholder="ABC-1234"
                    value={formBalanca.placa_veiculo} onChange={e => setFormBalanca(p => ({ ...p, placa_veiculo: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formBalanca.tipo_operacao} onChange={e => setFormBalanca(p => ({ ...p, tipo_operacao: e.target.value }))}>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Motorista</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={formBalanca.motorista} onChange={e => setFormBalanca(p => ({ ...p, motorista: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Peso de Entrada (kg)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={formBalanca.peso_entrada_kg} onChange={e => setFormBalanca(p => ({ ...p, peso_entrada_kg: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalBalanca(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={abrirTicket} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700">Abrir Ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Saída */}
      {ticketSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-1">⚖️ Registrar Saída</h3>
            <p className="text-sm text-gray-500 mb-4">Ticket #{ticketSelecionado.numero_ticket} — {ticketSelecionado.placa_veiculo}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Peso de Saída (kg)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={formSaida.peso_saida_kg} onChange={e => setFormSaida(p => ({ ...p, peso_saida_kg: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Umidade (%)</label>
                  <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formSaida.umidade_percentual} onChange={e => setFormSaida(p => ({ ...p, umidade_percentual: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Impureza (%)</label>
                  <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formSaida.impureza_percentual} onChange={e => setFormSaida(p => ({ ...p, impureza_percentual: e.target.value }))} />
                </div>
              </div>
              {formSaida.peso_saida_kg && (
                <div className="bg-green-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-green-800">Cálculo Automático:</p>
                  <p className="text-green-700">Peso Líquido: {Math.abs(Number(formSaida.peso_saida_kg) - Number(ticketSelecionado.peso_entrada_kg)).toLocaleString('pt-BR')} kg</p>
                  <p className="text-green-700">Sacas (60kg): {(Math.abs(Number(formSaida.peso_saida_kg) - Number(ticketSelecionado.peso_entrada_kg)) / 60).toFixed(2)}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setTicketSelecionado(null)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={registrarSaida} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700">Confirmar Saída</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Romaneio */}
      {modalRomaneio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-4">📋 Novo Romaneio</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formRomaneio.tipo} onChange={e => setFormRomaneio(p => ({ ...p, tipo: e.target.value }))}>
                    <option value="compra">Compra</option>
                    <option value="venda">Venda</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Placa</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm uppercase"
                    value={formRomaneio.placa_veiculo} onChange={e => setFormRomaneio(p => ({ ...p, placa_veiculo: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Peso Bruto (kg)</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formRomaneio.peso_bruto_kg} onChange={e => setFormRomaneio(p => ({ ...p, peso_bruto_kg: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tara (kg)</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formRomaneio.peso_tara_kg} onChange={e => setFormRomaneio(p => ({ ...p, peso_tara_kg: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Umidade (%)</label>
                  <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formRomaneio.umidade_percentual} onChange={e => setFormRomaneio(p => ({ ...p, umidade_percentual: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Impureza (%)</label>
                  <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formRomaneio.impureza_percentual} onChange={e => setFormRomaneio(p => ({ ...p, impureza_percentual: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Preço/Saca (R$)</label>
                  <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formRomaneio.valor_unitario} onChange={e => setFormRomaneio(p => ({ ...p, valor_unitario: e.target.value }))} />
                </div>
              </div>
              {formRomaneio.peso_bruto_kg && formRomaneio.peso_tara_kg && (
                <div className="bg-green-50 rounded-lg p-3 text-sm">
                  {(() => {
                    const liq = Math.abs(Number(formRomaneio.peso_bruto_kg) - Number(formRomaneio.peso_tara_kg));
                    const u = Number(formRomaneio.umidade_percentual) || 0;
                    const i = Number(formRomaneio.impureza_percentual) || 0;
                    const desc = liq * (1 - Math.max(0, (u - 13)) / 100 - i / 100);
                    const sc = desc / 60;
                    const vt = sc * Number(formRomaneio.valor_unitario || 0);
                    return <>
                      <p className="font-medium text-green-800">Cálculo:</p>
                      <p>Peso Líquido: {liq.toLocaleString('pt-BR')} kg</p>
                      <p>Peso Descontado: {desc.toFixed(2)} kg</p>
                      <p>Sacas: {sc.toFixed(2)}</p>
                      {vt > 0 && <p className="font-bold">Valor Total: R$ {vt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
                    </>;
                  })()}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalRomaneio(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={criarRomaneio} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700">Emitir Romaneio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
